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

router.get('/leads', async (req, res) => {
  try {
    const db = getDB();
    const leads = await db.prepare(`
      SELECT 
        id, name, phone, email, 
        apartment_type, budget, purpose, timeline, 
        score, source, utm_source, utm_campaign,
        ip, created_at
      FROM leads
      WHERE phone IS NOT NULL AND phone != ''
      ORDER BY created_at DESC
    `).all();

    res.json({
      count: leads.length,
      leads: leads
    });
  } catch (err) {
    console.error('❌ Admin API Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// GET /api/admin/stats - Basic summary
router.get('/stats', async (req, res) => {
  try {
    const db = getDB();
    const stats = await db.prepare(`
      SELECT 
        source, 
        COUNT(*) as total,
        AVG(score) as avg_score
      FROM leads
      GROUP BY source
    `).all();

    res.json(stats);
  } catch (err) {
    console.error('❌ Admin Stats Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
