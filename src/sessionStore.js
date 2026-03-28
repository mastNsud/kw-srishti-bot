const { getDB } = require('./db');

const store = new Map();

async function getOrCreateSession(sid) {
  if (store.has(sid)) return store.get(sid);
  // Try loading from DB
  try {
    const db = getDB();
    const row = await db.prepare('SELECT data FROM sessions WHERE id=$1').get(sid);
    if (row) {
      const session = JSON.parse(row.data);
      store.set(sid, session);
      return session;
    }
  } catch (e) { console.error('Session load error:', e); }
  const session = { id: sid, step: 0, leadData: {}, history: [], createdAt: Date.now() };
  store.set(sid, session);
  return session;
}

async function saveSession(sid, session) {
  session.updatedAt = Date.now();
  store.set(sid, session);
  try {
    const db = getDB();
    await db.prepare(`
      INSERT INTO sessions (id, data) VALUES ($1,$2)
      ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data, updated_at=CURRENT_TIMESTAMP
    `).run(sid, JSON.stringify(session));
  } catch (e) { console.error('Session save error:', e); }
}

module.exports = { getOrCreateSession, saveSession };
