# KW Srishti LeadBot 🏠

A production-grade AI-powered lead qualification chatbot + landing page for KW Srishti.
Built to deploy on Railway in under 10 minutes.

---

## 🏗️ Project Structure

```
kw-srishti-bot/
├── src/
│   ├── server.js          # Express app entry point
│   ├── db.js              # SQLite database init
│   ├── sessionStore.js    # In-memory + DB session store
│   ├── botEngine.js       # Conversation flow + AI fallback
│   ├── routes/
│   │   ├── chat.js        # POST /api/chat/message
│   │   ├── leads.js       # GET/PATCH /api/leads
│   │   └── admin.js       # POST /api/admin/login
│   └── middleware/
│       └── auth.js        # Admin token middleware
├── public/
│   ├── index.html         # Landing page + chat widget
│   └── admin.html         # Lead management dashboard
├── data/                  # SQLite DB (Railway volume)
├── railway.toml           # Railway config
├── .env.example           # Environment variables
└── package.json
```

---

## 🚀 Deploy to Railway (10 minutes)

### Step 1 — Push to GitHub
```bash
cd kw-srishti-bot
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/kw-srishti-bot.git
git push -u origin main
```

### Step 2 — Create Railway Project
1. Go to [railway.com](https://railway.com) → New Project
2. Select **Deploy from GitHub repo**
3. Authorize Railway and select your repo

### Step 3 — Add a Volume (for SQLite)
1. In your Railway project, click **+ New** → **Volume**
2. Mount path: `/app/data`
3. This persists your leads database across deploys

### Step 4 — Set Environment Variables
In Railway → your service → **Variables**, add:

| Variable | Value |
|---|---|
| `PORT` | `3000` |
| `ADMIN_PASSWORD` | `your_secure_password` |
| `DB_PATH` | `/app/data/leads.db` |
| `ANTHROPIC_API_KEY` | *(optional)* your Claude API key |

### Step 5 — Deploy
Railway will auto-deploy from your GitHub push. In ~2 minutes you'll get a public URL like:
`https://kw-srishti-bot.up.railway.app`

### Step 6 — Access Admin Dashboard
Visit: `https://your-app.up.railway.app/admin`
Login with your `ADMIN_PASSWORD`

---

## 📊 Admin Dashboard Features

- **Real-time lead table** — name, phone, unit type, budget, score, status
- **Lead scoring** — auto-scored 0–100 based on intent signals
- **Mini charts** — distribution by unit type, budget, timeline
- **Status management** — mark leads as new / contacted / warm / hot / converted / lost
- **Notes** — add advisor notes per lead
- **Conversation view** — see full chat history per lead
- **CSV export** — one-click download for CRM import
- **Auto-refresh** every 30 seconds

---

## 🤖 Chatbot Flow

The bot collects:
1. Name
2. Apartment type (1BHK → Penthouse)
3. Purchase purpose (self/investment/both)
4. Budget bracket
5. Decision timeline
6. Mobile number (validated)
7. Email (optional)

After completion: displays lead summary + triggers advisor callback CTA.

**Free-form Q&A** handles 12+ topic categories (location, pricing, amenities, loans, legal, etc.)

**AI Fallback**: If `ANTHROPIC_API_KEY` is set, unrecognized questions are answered by Claude Haiku.

---

## 💰 Lead Scoring Logic

| Signal | Points |
|---|---|
| Name collected | +10 |
| Phone collected | +25 |
| Email collected | +15 |
| Timeline: within 1 month or 1–3 months | +20 |
| Unit: 3BHK or Penthouse | +10 |
| Budget: ₹90 Lakh+ | +10 |
| Purpose: Self-occupation | +10 |

**Hot lead**: Score ≥ 70 → Call within 2 hours

---

## 🌐 UTM Tracking

Append UTM params to capture campaign source:
```
https://your-app.up.railway.app/?utm_source=facebook&utm_campaign=diwali-offer
```

All UTM data is stored with each lead for ROI attribution.

---

## 📱 Embed on Any Website

Add this snippet to any existing website:
```html
<script>
  window.KW_BOT_URL = 'https://your-app.up.railway.app';
</script>
<script src="https://your-app.up.railway.app/widget.js" async></script>
```

---

## 🔧 Custom Domain (Optional)

In Railway → Settings → Domains → Add custom domain
Then update your DNS CNAME to point to Railway.

---

## 📞 Contact & Support

KW Srishti: +91-9310 90 8888
Email: saleskws@kwgroup.in
