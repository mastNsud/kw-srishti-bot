const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/leads.db');
let sqlDb;

// ─── Save database to disk after every write ────────────────────────────────
function saveDB() {
  const data = sqlDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ─── Compatibility shim: makes sql.js look like better-sqlite3 ───────────────
//     so all route files can stay exactly as they are.
class Statement {
  constructor(sql) {
    this._sql = sql;
  }

  run(...args) {
    const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
    sqlDb.run(this._sql, params);
    saveDB();
    const row = sqlDb.exec('SELECT last_insert_rowid() AS id')[0];
    return { lastInsertRowid: row ? row.values[0][0] : null };
  }

  get(...args) {
    const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
    const stmt = sqlDb.prepare(this._sql);
    stmt.bind(params);
    const result = stmt.step() ? stmt.getAsObject() : undefined;
    stmt.free();
    return result;
  }

  all(...args) {
    const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
    const stmt = sqlDb.prepare(this._sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }
}

class DBWrapper {
  prepare(sql) { return new Statement(sql); }
  exec(sql)    { sqlDb.run(sql); saveDB(); }
}

const dbWrapper = new DBWrapper();

// ─── Init ────────────────────────────────────────────────────────────────────
async function initDB() {
  const SQL = await initSqlJs();

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    sqlDb = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    sqlDb = new SQL.Database();
  }

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      name TEXT, phone TEXT, email TEXT,
      apartment_type TEXT, budget TEXT,
      purpose TEXT, timeline TEXT,
      score INTEGER DEFAULT 0,
      status TEXT DEFAULT 'new',
      source TEXT DEFAULT 'website',
      utm_source TEXT, utm_campaign TEXT,
      ip TEXT, user_agent TEXT,
      conversation TEXT, notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      event_type TEXT,
      payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  saveDB();
  console.log('✅ Database initialised');
}

function getDB() { return dbWrapper; }

module.exports = { initDB, getDB };
