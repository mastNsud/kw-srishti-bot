const { getDB } = require('./db');
const { calcScore } = require('./botEngine');

async function upsertLead(sid, session, req = {}) {
  const d = session.leadData || {};
  
  // Only storage if we have at least a phone or name
  if (!d.phone && !d.name) {
    console.log(`ℹ️ Skipping upsert for ${sid} - no phone or name yet.`);
    return;
  }

  const score = calcScore(d);
  const db = getDB();
  
  // Determine source
  const source = session.source || (sid.startsWith('tg_') ? 'telegram' : 'website');

  console.log(`💾 Persisting Lead [${sid}]:`, JSON.stringify({ name: d.name, phone: d.phone, score }));

  try {
    await db.prepare(`
      INSERT INTO leads (
        session_id, name, phone, email, 
        apartment_type, budget, purpose, timeline, 
        score, source, utm_source, utm_campaign, 
        ip, location, language, demographics, profiling_notes,
        conversation
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
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
        location=EXCLUDED.location,
        language=EXCLUDED.language,
        demographics=EXCLUDED.demographics,
        profiling_notes=EXCLUDED.profiling_notes,
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
      d.location || null,
      d.language || null,
      d.demographics || null,
      d.profiling_notes || null,
      JSON.stringify(session.history || [])
    );
    console.log(`✅ Lead successfully updated in DB: ${d.name || 'Anonymous'}`);
    
    // Alert sales team if lead is high-intent (has phone)
    if (d.phone) {
      notifySalesTeam(sid, d, score, source);
    }
  } catch (err) {
    console.error('❌ Error upserting lead:', err.message);
  }
}

function notifySalesTeam(sid, data, score, source) {
  const alert = `
***************************************************
🔥 NEW HOT LEAD ALERT [${source.toUpperCase()}] 🔥
***************************************************
Name: ${data.name || 'Unknown'}
Phone: ${data.phone}
Type: ${data.apartment_type || 'N/A'}
Budget: ${data.budget || 'N/A'}
Score: ${score}/100
Location: ${data.location || 'N/A'}
Logic: Priya AI (Structured Extraction)
***************************************************
`;
  console.log(alert);
  
  // Future: Integration with Telegram/Twilio/SendGrid would go here
  if (process.env.SALES_ALERT_WEBHOOK) {
    // fetch(process.env.SALES_ALERT_WEBHOOK, { ... })
  }
}
async function logChatEvent(sid, role, text, meta = {}) {
  try {
    const db = getDB();
    await db.prepare('INSERT INTO events (session_id, event_type, payload) VALUES ($1,$2,$3)')
      .run(sid, 'chat_message', JSON.stringify({ role, text, ...meta }));
    
    // Note: We no longer update the 'leads' table here as it's redundant and 
    // potentially overwrites rich history with plain text. 
    // UpsertLead (called in chat.js) handles full history sync.

  } catch (err) {
    console.error('❌ Error logging chat event:', err.message);
  }
}

module.exports = { upsertLead, logChatEvent };
