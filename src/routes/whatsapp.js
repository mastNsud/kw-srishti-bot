const express = require('express');
const router = express.Router();
const botEngine = require('../botEngine');
const fetch = require('node-fetch'); // Ensure fetch is available

// In-memory sessions for WhatsApp (Simple implementation)
const waSessions = {};

/**
 * WAHA Webhook Handler
 */
router.post('/webhook', async (req, res) => {
    const { event, payload } = req.body;

    // Support both 'message.upsert' and plain 'message' events from WAHA
    if (event !== 'message.upsert' && event !== 'message') {
        return res.sendStatus(200);
    }

    const message = payload;
    const from = message.from; // Sender ID: 91XXXXXXXXXX@c.us
    const text = message.body || "";

    // Ignore empty messages or messages FROM the bot itself
    if (!text || message.fromMe) return res.sendStatus(200);

    console.log(`📱 [WhatsApp] Message from ${from}: ${text}`);

    // Initialize or retrieve session
    if (!waSessions[from]) {
        waSessions[from] = {
            id: `wa_${from}`,
            leadData: {},
            history: []
        };
    }

    const session = waSessions[from];

    try {
        // Build the AI response using Priya's engine
        const result = await botEngine.buildBotResponse(session, text);
        
        if (result && result.message) {
            const wahaUrl = process.env.WAHA_URL || 'http://localhost:3000';
            const wahaKey = process.env.WAHA_API_KEY;
            const buttons = result.buttons || [];

            console.log(`🤖 [WhatsApp] Priya replying to ${from} with ${buttons.length} buttons`);

            let endpoint = '/api/sendText';
            let body = {
                session: "default",
                chatId: from,
                text: result.message
            };

            // Interactive UI Logic
            if (buttons.length > 0 && buttons.length <= 3) {
                // Use Buttons (1-3 items)
                endpoint = '/api/sendButtons';
                body.buttons = buttons.map(btn => ({
                    id: btn.toLowerCase().replace(/\s+/g, '_'),
                    text: btn
                }));
            } else if (buttons.length > 3) {
                // Use List (4+ items)
                endpoint = '/api/sendList';
                body.button = "Options"; // Text on the button that opens the list
                body.title = "Please choose an option";
                body.sections = [{
                    title: "Project Menu",
                    rows: buttons.map(btn => ({
                        id: btn.toLowerCase().replace(/\s+/g, '_'),
                        title: btn
                    }))
                }];
                // Note: body.text is still used as the message content before the list
            }

            await fetch(`${wahaUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': wahaKey
                },
                body: JSON.stringify(body)
            });
        }
    } catch (err) {
        console.error('❌ WhatsApp Webhook Error:', err);
    }

    res.sendStatus(200);
});

module.exports = router;
