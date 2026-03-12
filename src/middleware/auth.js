function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token === (process.env.ADMIN_PASSWORD || 'kw@admin2024')) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { requireAdmin };
