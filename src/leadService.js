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

/**
 * Background Reconciliation:
 * Scans events from the last 15 minutes to recover any missing lead info.
 */
async function reconcileLeadsFromEvents() {
  console.log('🔄 [Reconciliation] Scanning recent events for missed leads...');
  const db = getDB();
  const { extractLeadData } = require('./botEngine');
  const { getOrCreateSession, saveSession } = require('./sessionStore');

  try {
    // 1. Get unique session IDs from the last 15 minutes of chat activity
    const recentSessions = await db.prepare(`
      SELECT DISTINCT session_id 
      FROM events 
      WHERE event_type = 'chat_message' 
      AND created_at > (CURRENT_TIMESTAMP - INTERVAL '15 minutes')
    `).all();

    if (recentSessions.length === 0) return;

    for (const { session_id } of recentSessions) {
      // 2. Check if this session already has a "qualified" lead (with phone)
      const existing = await db.prepare('SELECT phone FROM leads WHERE session_id = $1').get(session_id);
      
      if (existing?.phone) continue; // Already captured, skip

      // 3. If missing, attempt to recover from session history
      const session = await getOrCreateSession(session_id);
      let foundNewInfo = false;

      for (const msg of session.history) {
        if (msg.role === 'user') {
          const before = JSON.stringify(session.leadData);
          await extractLeadData(msg.text, session.leadData);
          if (JSON.stringify(session.leadData) !== before) {
            foundNewInfo = true;
          }
        }
      }

      if (foundNewInfo) {
        console.log(`✨ [Reconciliation] Recovered data for ${session_id}. Syncing...`);
        await saveSession(session_id, session);
        await upsertLead(session_id, session);
      }
    }
  } catch (err) {
    console.error('❌ [Reconciliation] Error:', err.message);
  }
}

function startBackgroundSync(intervalMinutes = 10) {
  console.log(`🤖 Background Reconciliation started (Every ${intervalMinutes} mins)`);
  setInterval(reconcileLeadsFromEvents, intervalMinutes * 60 * 1000);
  // Run once on start
  setTimeout(reconcileLeadsFromEvents, 10000); 
}

module.exports = { upsertLead, logChatEvent, startBackgroundSync };
