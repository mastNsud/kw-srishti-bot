const { getDB } = require('./db');
const { calcScore } = require('./botEngine');

async function upsertLead(sid, session, req = {}) {
  const d = session.leadData || {};
  
  // Only storage if we have at least a phone or name
  if (!d.phone && !d.name) return;

  const score = calcScore(d);
  const db = getDB();
  
  // Determine source
  const source = session.source || (sid.startsWith('tg_') ? 'telegram' : 'website');

  try {
    await db.prepare(`
      INSERT INTO leads (
        session_id, name, phone, email, 
        apartment_type, budget, purpose, timeline, 
        score, source, utm_source, utm_campaign, 
        ip, conversation
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT(session_id) DO UPDATE SET
        name=EXCLUDED.name, 
        phone=EXCLUDED.phone, 
        email=EXCLUDED.email,
        apartment_type=EXCLUDED.apartment_type, 
        budget=EXCLUDED.budget,
        purpose=EXCLUDED.purpose, 
        timeline=EXCLUDED.timeline,
        score=EXCLUDED.score,
        source=EXCLUDED.source, 
        conversation=EXCLUDED.conversation,
        updated_at=CURRENT_TIMESTAMP
    `).run(
      sid, 
      d.name || null, 
      d.phone || null, 
      d.email || null,
      d.apartment_type || null, 
      d.budget || null, 
      d.purpose || null, 
      d.timeline || null,
      score, 
      source,
      session.utm_source || null, 
      session.utm_campaign || null,
      req.ip || null, 
      JSON.stringify(session.history || [])
    );
    console.log(`✅ Lead updated [${source}]: ${d.name || 'Anonymous'} (Score: ${score})`);
  } catch (err) {
    console.error('❌ Error upserting lead:', err.message);
  }
}

module.exports = { upsertLead };
