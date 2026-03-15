const { Pool } = require('pg');

let pool;

async function initDB() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL is not set in environment variables');
    process.exit(1);
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Test the connection
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL');
    client.release();

    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
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
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        session_id TEXT,
        event_type TEXT,
        payload TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Database schema verified/created');
  } catch (err) {
    console.error('❌ Database initialisation error:', err);
    process.exit(1);
  }
}

const dbWrapper = {
  // Adaptation layer to keep some similarity but return promises
  query: (text, params) => pool.query(text, params),
  
  // Shim for the old 'prepare' API style but async
  prepare: (sql) => ({
    get: async (...args) => {
      const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      const res = await pool.query(sql, params);
      return res.rows[0];
    },
    all: async (...args) => {
      const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      const res = await pool.query(sql, params);
      return res.rows;
    },
    run: async (...args) => {
      const params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      const res = await pool.query(sql, params);
      return { lastInsertRowid: res.rows[0] ? res.rows[0].id : null };
    }
  })
};

function getDB() {
  if (!pool) throw new Error('DB not initialised. Call initDB() first.');
  return dbWrapper;
}

module.exports = { initDB, getDB };
