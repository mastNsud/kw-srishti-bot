const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const { getOrCreateSession, saveSession } = require('../sessionStore');
const { buildBotResponse } = require('../botEngine');

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
      session.source = meta.source || 'website';
    }

    // Log event
    const db = getDB();
    await db.prepare('INSERT INTO events (session_id, event_type, payload) VALUES ($1,$2,$3)')
      .run(sid, 'message', JSON.stringify({ message, quick_reply }));

    const userInput = quick_reply || message || '';
    const result = await buildBotResponse(session, userInput, req);

    await saveSession(sid, session);

    // If lead data is complete, upsert to leads table
    if (session.leadData?.phone) {
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

async function upsertLead(sid, session, req) {
  const d = session.leadData;
  const score = calcScore(d);
  const db = getDB();
  await db.prepare(`
    INSERT INTO leads (session_id, name, phone, email, apartment_type, budget, purpose, timeline, score, utm_source, utm_campaign, ip, conversation)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    ON CONFLICT(session_id) DO UPDATE SET
      name=EXCLUDED.name, phone=EXCLUDED.phone, email=EXCLUDED.email,
      apartment_type=EXCLUDED.apartment_type, budget=EXCLUDED.budget,
      purpose=EXCLUDED.purpose, timeline=EXCLUDED.timeline,
      score=EXCLUDED.score, conversation=EXCLUDED.conversation,
      updated_at=CURRENT_TIMESTAMP
  `).run(
    sid, d.name, d.phone, d.email || null,
    d.apartment_type, d.budget, d.purpose, d.timeline,
    score, session.utm_source, session.utm_campaign,
    req.ip, JSON.stringify(session.history || [])
  );
}

function calcScore(d) {
  let score = 0;
  if (d.name) score += 10;
  if (d.phone) score += 25;
  if (d.email) score += 15;
  if (['Within 1 month', '1–3 months'].includes(d.timeline)) score += 20;
  if (['3 BHK', 'Penthouse / 4 BHK'].includes(d.apartment_type)) score += 10;
  if (d.budget === '₹90 Lakh+') score += 10;
  if (d.purpose === 'Self-occupation') score += 10;
  return Math.min(score, 100);
}

module.exports = router;
