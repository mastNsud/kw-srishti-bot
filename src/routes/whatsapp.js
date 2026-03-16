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
            // Send back to WAHA
            const wahaUrl = process.env.WAHA_URL || 'http://localhost:3000'; // Default to localhost if not set
            const wahaKey = process.env.WAHA_API_KEY;

            console.log(`🤖 [WhatsApp] Priya replying: ${result.message}`);

            await fetch(`${wahaUrl}/api/sendText`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': wahaKey
                },
                body: JSON.stringify({
                    session: "default",
                    chatId: from,
                    text: result.message
                })
            });
        }
    } catch (err) {
        console.error('❌ WhatsApp Webhook Error:', err);
    }

    res.sendStatus(200);
});

module.exports = router;
