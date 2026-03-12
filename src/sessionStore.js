const { getDB } = require('./db');

const store = new Map();

function getOrCreateSession(sid) {
  if (store.has(sid)) return store.get(sid);
  // Try loading from DB
  try {
    const db = getDB();
    const row = db.prepare('SELECT data FROM sessions WHERE id=?').get(sid);
    if (row) {
      const session = JSON.parse(row.data);
      store.set(sid, session);
      return session;
    }
  } catch (e) { /* ignore */ }
  const session = { id: sid, step: 0, leadData: {}, history: [], createdAt: Date.now() };
  store.set(sid, session);
  return session;
}

function saveSession(sid, session) {
  session.updatedAt = Date.now();
  store.set(sid, session);
  try {
    const db = getDB();
    db.prepare(`
      INSERT INTO sessions (id, data) VALUES (?,?)
      ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=CURRENT_TIMESTAMP
    `).run(sid, JSON.stringify(session));
  } catch (e) { /* ignore */ }
}

module.exports = { getOrCreateSession, saveSession };
