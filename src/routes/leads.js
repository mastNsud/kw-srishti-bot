const express = require('express');
const { getDB } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/leads/stats — MUST be before /:id
router.get('/stats', requireAdmin, (req, res) => {
  const db = getDB();
  const total    = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
  const today    = db.prepare("SELECT COUNT(*) as c FROM leads WHERE date(created_at)=date('now')").get().c;
  const hot      = db.prepare('SELECT COUNT(*) as c FROM leads WHERE score >= 70').get().c;
  const byType   = db.prepare('SELECT apartment_type, COUNT(*) as c FROM leads GROUP BY apartment_type').all();
  const byBudget = db.prepare('SELECT budget, COUNT(*) as c FROM leads GROUP BY budget').all();
  const byTimeline = db.prepare('SELECT timeline, COUNT(*) as c FROM leads GROUP BY timeline').all();
  const byStatus = db.prepare('SELECT status, COUNT(*) as c FROM leads GROUP BY status').all();
  res.json({ total, today, hot, byType, byBudget, byTimeline, byStatus });
});

// GET /api/leads/export.csv — MUST be before /:id
router.get('/export.csv', requireAdmin, (req, res) => {
  const db = getDB();
  const leads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  const headers = ['id','name','phone','email','apartment_type','budget','purpose','timeline','score','status','utm_source','utm_campaign','created_at'];
  const csv = [
    headers.join(','),
    ...leads.map(l => headers.map(h => `"${(l[h]||'').toString().replace(/"/g,'""')}"`).join(','))
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="kw-srishti-leads.csv"');
  res.send(csv);
});

// GET /api/leads
router.get('/', requireAdmin, (req, res) => {
  const { status, limit = 50, offset = 0, search } = req.query;
  const db = getDB();

  let query = 'SELECT * FROM leads';
  const params = [];
  const conditions = [];

  if (status) { conditions.push('status=?'); params.push(status); }
  if (search) {
    conditions.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const leads = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;

  res.json({ leads, total, limit, offset });
});

// PATCH /api/leads/:id — update status/notes
router.patch('/:id', requireAdmin, (req, res) => {
  const { status, notes } = req.body;
  const db = getDB();
  db.prepare('UPDATE leads SET status=COALESCE(?,status), notes=COALESCE(?,notes), updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(status || null, notes || null, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
