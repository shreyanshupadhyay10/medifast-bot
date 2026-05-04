# MediFast AI

India-first AI medicine assistant for Telegram (WhatsApp-ready architecture).

MediFast AI helps users:
- search medicines instantly (name, brand, generic, typo tolerant)
- search in Hindi/Hinglish symptom style (e.g., `bukhar ki tablet`, `sar dard`)
- manage family medicine needs
- discover nearby pharmacies (area + location-ready module)
- raise SOS alerts for hard-to-find medicines
- get reorder hints from recent search history

> ⚠️ Medical safety: This bot helps discover medicines and is not a replacement for a doctor.

---

## What This Project Is

This project upgrades the original Jaipur pharmacy Telegram bot into a startup-style MVP named **MediFast AI**, while preserving existing working flows.

### Upgrade Highlights (from previous version)

- ✅ Natural-language symptom intent mapping (Hindi + Hinglish + English)
- ✅ Family profile onboarding and member management
- ✅ Cleaner premium Telegram response formatting
- ✅ Reorder suggestion using user search history
- ✅ Nearby pharmacy integration-ready architecture
- ✅ SOS workflow for rare/unavailable medicines
- ✅ Alias-aware search expansion (e.g. Modafinil/Modalert/Moda Alert, Ivermectin/Ivak)
- ✅ Better onboarding UX with inline actions

---

## Tech Stack

- **Runtime:** Node.js (>=18)
- **Bot Framework:** grammY
- **API Server:** Express
- **Database:** MongoDB + Mongoose
- **Search:** Fuse.js fuzzy matching
- **Logging:** Winston
- **Security:** Helmet, CORS, express-rate-limit
- **Config:** dotenv (`.env`)

---

## Repository Structure

```txt
src/
  bot/
    commands/
      admin.js
      family.js
      nearby.js
      search.js
      sos.js
    middleware/
      adminGuard.js
      rateLimiter.js
    index.js
  models/
    Inventory.js
    Pharmacy.js
    SearchHistory.js
    SosRequest.js
    UserProfile.js
  services/
    familyService.js
    historyService.js
    intentEngine.js
    medicineAliasService.js
    nearbyPharmacyService.js
    searchService.js
  utils/
    formatter.js
    logger.js
  index.js
  server.js
scripts/
  seed.js
```

---

## Features and Commands

### User Commands

- `/start` — welcome + language + quick actions
- `/help` — all user commands
- `/about` — product info
- `/feedback` — share product feedback
- `/search <medicine or symptom>` — search availability
- `/nearby` — nearby pharmacies (area list + location sharing)
- `/areas` — covered area list
- `/sos <medicine name>` — raise alert for unavailable medicine
- `/family` — family dashboard
- `/addmember` — add member (`Name|relation|age group|notes`)
- `/members` — view members
- `/removeMember <name/relation>` — remove member

### Admin Commands

- `/admin`
- `/addpharmacy`
- `/addmedicine`
- `/updatestock`
- `/opensos`
- `/stats`

### Natural Input Examples

- `Sar dard ki dawa chaiye`
- `Bukhar ki tablet`
- `Pet dard medicine`
- `Gas acidity tablet`
- `Khansi ke liye kuch`
- `reorder papa medicine`
- `mom fever medicine`
- `moda alert` / `modafinil`
- `ivak` / `ivermectin`

---

## Setup

### 1) Clone and install

```bash
git clone <your-fork-url>
cd medifast-bot
npm install
```

### 2) Configure environment

Create `.env` from `.env.example` and set required values:

```env
PORT=3000
MONGODB_URI=<your_mongodb_connection_string>
TELEGRAM_BOT_TOKEN=<your_telegram_bot_token>
ADMIN_TELEGRAM_IDS=123456789,987654321
```

### 3) Optional: seed sample data

```bash
npm run seed
```

### 4) Run

```bash
npm run dev
# or
npm start
```

---

## How To Run and Check in Terminal

Use these exact commands:

```bash
# install deps
npm install

# run placeholder tests
npm test

# module sanity checks
node -e "require('./src/services/intentEngine'); require('./src/services/medicineAliasService'); require('./src/bot/commands/search'); console.log('module-check-ok')"

# start app
npm run dev
```

If app starts successfully, you should see server/bot startup logs.

---

## Demo Flow (Hackathon Friendly)

1. `/start`
2. Select language
3. Tap `Add Family Member`
4. `/addmember Papa|papa|senior|diabetes and BP`
5. Search with symptom: `bukhar ki tablet`
6. Search with alias: `moda alert`
7. Family contextual query: `reorder papa medicine`
8. `/nearby` and share location
9. `/sos rare medicine name`

---

## Production-Safe Notes

- Existing commands and behavior are preserved; additions are modular.
- All runtime config is env-driven.
- No hardcoded secrets.
- Nearby location path is integration-ready placeholder architecture for maps/provider plug-in.

---

## Roadmap (Next Iteration)

- Full India medicine catalog ingestion pipeline
- Geo-distance pharmacy ranking (5km/10km)
- Guardian alert notifications on reorder/order events
- WhatsApp channel integration
- Analytics dashboard for unresolved search intents

