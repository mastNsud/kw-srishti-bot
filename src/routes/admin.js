const express = require('express');
const { getDB } = require('../db');

const router = express.Router();

// GET /api/admin/leads - Fetch all qualified leads
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
