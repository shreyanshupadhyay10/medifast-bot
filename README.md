# 🏥 Jaipur Pharmacy Availability Bot

A hyperlocal Telegram bot for Jaipur citizens to instantly find which nearby pharmacies have a medicine in stock. Built for a 48-hour hackathon.

---

## 🗂️ Project Structure

```
jaipur-pharmacy-bot/
├── config/
│   └── database.js              # MongoDB connection
├── scripts/
│   └── seed.js                  # Seed DB with sample pharmacies & medicines
├── src/
│   ├── bot/
│   │   ├── commands/
│   │   │   ├── admin.js         # Admin commands (add pharmacy, medicine, stats)
│   │   │   ├── nearby.js        # /nearby and /areas commands
│   │   │   ├── search.js        # /search and plain-text search handler
│   │   │   └── sos.js           # /sos multi-step alert flow
│   │   ├── middleware/
│   │   │   ├── adminGuard.js    # Restrict commands to admin Telegram IDs
│   │   │   └── rateLimiter.js   # In-memory rate limiter (15 req/min per user)
│   │   └── index.js             # Bot creation, command registration
│   ├── models/
│   │   ├── Inventory.js         # Medicine inventory schema
│   │   ├── Pharmacy.js          # Pharmacy schema
│   │   └── SosRequest.js        # SOS alert schema
│   ├── services/
│   │   └── searchService.js     # Fuse.js fuzzy search + SOS logic
│   ├── utils/
│   │   ├── formatter.js         # Telegram HTML message formatters
│   │   └── logger.js            # Winston logger
│   ├── index.js                 # App entry point
│   └── server.js                # Express server + REST API + webhook mount
├── .env.example
├── .gitignore
├── package.json
└── render.yaml                  # One-click Render deploy config
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From [@BotFather](https://t.me/BotFather) |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `PORT` | Server port (default: 3000) |
| `NODE_ENV` | `development` or `production` |
| `ADMIN_TELEGRAM_IDS` | Comma-separated Telegram user IDs |
| `SOS_ALERT_CHAT_ID` | Telegram group/channel ID for SOS broadcasts |
| `WEBHOOK_DOMAIN` | Your public HTTPS URL (production only) |

---

## 🚀 Local Development

### 1. Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier is fine)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env with your values
```

### 4. Seed the database
```bash
npm run seed
```

### 5. Start in dev mode (long-polling, no webhook needed)
```bash
npm run dev
```

The bot will start polling for updates. Open Telegram and send `/start` to your bot.

---

## 🌐 Deployment

### Option A: Render (Recommended — Free)

1. Push your code to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Render auto-detects `render.yaml` — click **Deploy**
5. In the Render dashboard → **Environment** tab, add all env variables
6. Set `WEBHOOK_DOMAIN` to your Render URL (e.g. `https://jaipur-pharmacy-bot.onrender.com`)
7. Set `NODE_ENV=production`

> ⚠️ Free Render instances spin down after 15 min of inactivity. Use a cron ping service like [cron-job.org](https://cron-job.org) to ping `/health` every 10 minutes.

### Option B: Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add all environment variables in the Railway dashboard
4. Railway auto-assigns a domain — set it as `WEBHOOK_DOMAIN`
5. Railway keeps the service always-on (no spin-down issue)

---

## 🤖 Bot Commands Reference

### User Commands
| Command | Description |
|---|---|
| `/start` | Welcome message |
| `/search <medicine>` | Search for a medicine |
| `/sos <medicine>` | Alert the network for a rare medicine |
| `/nearby` | Browse pharmacies by area |
| `/areas` | List all covered areas |
| `/help` | All commands |

### Admin Commands
| Command | Description |
|---|---|
| `/admin` | Admin menu |
| `/addpharmacy name\|area\|address\|phone\|hours` | Add a new pharmacy |
| `/addmedicine pharmacyId\|medicine\|price\|inStock\|generic\|category` | Add medicine to inventory |
| `/updatestock pharmacyId\|medicine\|true/false` | Update stock status |
| `/opensos` | View open SOS requests |
| `/stats` | Database statistics |

---

## 🔌 REST API Endpoints

| Endpoint | Description |
|---|---|
| `GET /` | Service info |
| `GET /health` | Health check with DB stats |
| `GET /api/search?q=paracetamol` | JSON medicine search |
| `GET /api/pharmacies?area=Mansarovar` | List pharmacies (optionally filtered) |

---

## 🧠 How Search Works

1. User sends a medicine name (e.g. "paracitamol" — misspelled)
2. All in-stock inventory is fetched from MongoDB with pharmacy details
3. **Fuse.js** runs fuzzy matching with configurable threshold (0.4) — handles typos, partial names, generic names
4. Results are sorted by match score and returned as a formatted Telegram message
5. If no results → user is prompted to raise an **SOS alert**
6. SOS alerts are stored in DB and broadcast to the admin Telegram group

---

## 📈 Scaling Beyond Hackathon

- **Redis** for rate limiting instead of in-memory Map
- **Mongoose pagination** for large result sets  
- **Webhook verification** (check `X-Telegram-Bot-Api-Secret-Token` header)
- **Admin web dashboard** using the REST API
- **Automated stock verification** — WhatsApp/SMS to pharmacies daily
- **Location-based search** using MongoDB `$near` with GPS coordinates
