const express = require('express');
const router = express.Router();
const botEngine = require('../botEngine');

/**
 * WAHA Webhook Handler
 * This receives messages from the WAHA service (WhatsApp HTTP API).
 * Documentation: https://waha.dev/docs/how-to/webhooks/
 */
router.post('/webhook', async (req, res) => {
    const { event, payload } = req.body;

    // We only care about message events
    if (event !== 'message.upsert' && event !== 'message') {
        return res.sendStatus(200);
    }

    const message = payload;
    const from = message.from; // Sender's WhatsApp ID (e.g. 919003068325@c.us)
    const text = message.body || "";

    if (!text || message.fromMe) return res.sendStatus(200);

    console.log(`📱 WhatsApp Message from ${from}: ${text}`);

    // Mock session for now (In real use, we'd fetch/store session in DB)
    const session = {
        id: `wa_${from}`,
        leadData: {},
        history: []
    };

    try {
        const result = await botEngine.buildBotResponse(session, text);
        
        // TODO: Call WAHA API to send 'result.message' back to 'from'
        // await waha.sendMessage(from, result.message);
        
        console.log(`🤖 Priya's WhatsApp response: ${result.message}`);
    } catch (err) {
        console.error('WhatsApp Bot Error:', err);
    }

    res.sendStatus(200);
});

module.exports = router;
