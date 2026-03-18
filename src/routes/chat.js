const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const { getOrCreateSession, saveSession } = require('../sessionStore');
const { buildBotResponse } = require('../botEngine');
const { upsertLead } = require('../leadService');

const router = express.Router();

// POST /api/chat/message
router.post('/message', async (req, res) => {
  try {
    const { session_id, message, quick_reply, meta = {} } = req.body;
    const sid = session_id || uuidv4();
    const session = await getOrCreateSession(sid);

    // Track UTM on first message
    if (meta.utm_source && !session.utm_source) {
      session.utm_source = meta.utm_source;
      session.utm_campaign = meta.utm_campaign;
    }
    session.source = meta.source || 'website';

    // Log event
    const db = getDB();
    await db.prepare('INSERT INTO events (session_id, event_type, payload) VALUES ($1,$2,$3)')
      .run(sid, 'message', JSON.stringify({ message, quick_reply }));

    const userInput = quick_reply || message || '';
    
    // IP-based Geocoding (First-party enrichment on website)
    if (session.source === 'website' && !session.leadData?.location && req.ip && req.ip !== '::1' && req.ip !== '127.0.0.1') {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${req.ip}?fields=status,city,regionName,country`);
        const geoData = await geoRes.json();
        if (geoData.status === 'success') {
          session.leadData = session.leadData || {};
          session.leadData.location = `${geoData.city}, ${geoData.regionName}`;
          console.log(`📍 Geocoded lead to: ${session.leadData.location}`);
        }
      } catch (err) {
        console.warn('⚠️ Geocoding failed:', err.message);
      }
    }

    const result = await buildBotResponse(session, userInput, req);

    await saveSession(sid, session);

    // If lead data is complete, upsert to leads table
    if (session.leadData?.phone || session.leadData?.name) {
      await upsertLead(sid, session, req);
    }

    res.json({ session_id: sid, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', message: 'Please try again' });
  }
});

// POST /api/chat/start
router.post('/start', async (req, res) => {
  const sid = uuidv4();
  const session = await getOrCreateSession(sid);
  const { meta = {} } = req.body || {};
  session.utm_source = meta.utm_source;
  session.utm_campaign = meta.utm_campaign;

  const db = getDB();
  await db.prepare('INSERT INTO events (session_id, event_type, payload) VALUES ($1,$2,$3)')
    .run(sid, 'session_start', JSON.stringify(meta));

  res.json({ session_id: sid, step: 0 });
});

async function upsertLeadLocal(sid, session, req) {
  // Deprecated: logic moved to leadService.js
  await upsertLead(sid, session, req);
}


module.exports = router;
