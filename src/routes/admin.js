const express = require('express');
const router = express.Router();

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === (process.env.ADMIN_PASSWORD || 'kw@admin2024')) {
    res.json({ token: process.env.ADMIN_PASSWORD || 'kw@admin2024', ok: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

module.exports = router;
