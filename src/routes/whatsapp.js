const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const botEngine = require('../botEngine');
const sessionStore = require('../sessionStore');

/**
 * Twilio WhatsApp Webhook
 */
router.post('/webhook', async (req, res) => {
    const { Body, From, ProfileName } = req.body;
    
    // Twilio From is in format "whatsapp:+91XXXXXXXXXX"
    const phone = From ? From.replace('whatsapp:', '') : 'unknown';
    const text = Body || "";

    if (!text) return res.send('<Response></Response>');

    console.log(`📱 [WhatsApp] Message from ${phone} (${ProfileName || 'User'}): ${text}`);
    
    // Log User Message
    const { logChatEvent } = require('../leadService');
    await logChatEvent(phone, 'user', text, { source: 'whatsapp', name: ProfileName });

    try {
        // Use phone number as Session ID for persistence across WhatsApp messages
        let session = await sessionStore.getOrCreateSession(phone);
        if (session) {
            // Update lead data if ProfileName is provided and name is currently empty
            if (ProfileName && (!session.leadData.name || session.leadData.name === 'pending')) {
                session.leadData.name = ProfileName;
            }
        }

        // Build Priya's AI response
        const result = await botEngine.buildBotResponse(session, text, req);
        
        // Log Bot Message
        await logChatEvent(phone, 'bot', result.message, { source: 'whatsapp' });
        
        // Save session state
        await sessionStore.saveSession(phone, session);

        // Generate TwiML Response
        const twiml = new twilio.twiml.MessagingResponse();
        const msg = twiml.message();
        
        let replyText = result.message;

        // If bot suggests buttons, append them as text (WhatsApp Sandbox doesn't support interactive buttons easily via TwiML yet)
        if (result.quick_replies && result.quick_replies.length > 0) {
            replyText += "\n\nOptions:\n" + result.quick_replies.map((q, i) => `${i+1}. ${q}`).join('\n');
        }

        msg.body(replyText);

        // Attach media (e.g., floor plans) if available
        if (result.media && result.media.length > 0) {
            const firstImage = result.media.find(m => m.type === 'image');
            // ONLY attach media if it's a valid external HTTP URL (e.g. Cloudinary)
            // Twilio drops the entire message if a local file returns 404.
            if (firstImage && firstImage.url.startsWith('http')) {
                msg.media(firstImage.url);
            }
        }


        res.type('text/xml').send(twiml.toString());
    } catch (err) {
        console.error('❌ WhatsApp Webhook Error:', err);
        if (err.stack) console.error(err.stack);
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message("I'm having a brief technical moment. Please try again later! ✨");
        res.type('text/xml').send(twiml.toString());
    }
});

module.exports = router;
