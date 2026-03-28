const express = require('express');
const { getDB } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/admin/login - Authenticate with password
router.post('/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).json({ ok: false, error: 'ADMIN_PASSWORD not set on server.' });
  }
  if (password === adminPassword) {
    // Issue a simple time-based token (not a full JWT, but sufficient for this use case)
    const token = Buffer.from(`kw:${Date.now()}`).toString('base64');
    return res.json({ ok: true, token });
  }
  return res.status(401).json({ ok: false, error: 'Invalid password' });
});

router.get('/leads', requireAdmin, async (req, res) => {
  try {
    const { status, search, limit = 100 } = req.query;
    const db = getDB();
    
    let query = `
      SELECT * FROM leads
      WHERE phone IS NOT NULL AND phone != ''
    `;
    const params = [];

    if (status && status !== 'All Status') {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      query += ` AND (name ILIKE $${idx} OR phone ILIKE $${idx} OR email ILIKE $${idx})`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const leads = await db.prepare(query).all(...params);
    res.json({ leads });
  } catch (err) {
    console.error('❌ Admin Leads API Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// GET /api/admin/stats - Basic summary
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const db = getDB();
    // PostgreSQL compatible stats check
    const overall = await db.prepare(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN created_at::date = CURRENT_DATE THEN 1 END)::int as today,
        COUNT(CASE WHEN score >= 70 THEN 1 END)::int as hot,
        ROUND(AVG(score), 1) as avg_score
      FROM leads
      WHERE phone IS NOT NULL AND phone != ''
    `).get();

    const byType = await db.prepare(`
      SELECT apartment_type, COUNT(*)::int as c 
      FROM leads 
      WHERE apartment_type IS NOT NULL AND apartment_type != ''
      GROUP BY apartment_type
      ORDER BY c DESC LIMIT 5
    `).all();

    res.json({
      ...overall,
      byType
    });
  } catch (err) {
    console.error('❌ Admin Stats Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
