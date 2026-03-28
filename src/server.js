require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDB } = require('./db');
const chatRouter = require('./routes/chat');
const leadsRouter = require('./routes/leads');
const whatsappRouter = require('./routes/whatsapp');
const adminRouter = require('./routes/admin');
const { startTelegramBot } = require('./telegramBot');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.ALLOWED_ORIGINS || '*' }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// Normalize double-slash URLs (e.g. Twilio configured with trailing slash: //api/...)
app.use((req, res, next) => {
  if (req.path.includes('//')) {
    return res.redirect(301, req.path.replace(/\/+/g, '/'));
  }
  next();
});

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: 'Too many requests' } });
const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Chat rate limit exceeded' } });

app.use('/api/', limiter);
app.use('/api/chat', chatLimiter);

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/chat', chatRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/whatsapp', whatsappRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/admin')) {
    return res.sendFile(path.join(__dirname, '../public/admin.html'));
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`🚀 KW Srishti Bot running on port ${PORT}`);
    startTelegramBot();
  });
}

start();

