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



🚀 MediFast Bot
Hyperlocal Medicine Access via Real-Time Inventory Tracking

MediFast is a specialized Telegram assistant designed to eliminate the "medicine hunt" in Jaipur. It bridges the gap between patients in need and local pharmacies by providing a searchable, live inventory database and an emergency SOS broadcast system.

📍 Project Status: Phase 1
This repository currently contains the core infrastructure for the MediFast Telegram Bot, focusing on:

User/Pharmacist Segmentation: Logic to handle different interactions for medicine seekers and providers.

Database Schema: Initial MongoDB models for Pharmacies, Inventory, and SOSRequests.

Search Foundation: Basic keyword-based search for medicine availability within the local database.

🌟 Key Features (Current & Roadmap)
Search & Find: Users can query for specific medicines to see which nearby shops have them in stock.

SOS Broadcast: When a medicine is unavailable, a user can trigger an SOS that alerts all registered pharmacies in a 5km radius.

Zero-Entry Inventory (Upcoming): Integration with OpenAI Vision API to allow pharmacists to update stock by simply snapping a photo of an invoice.

Agentic AI (Upcoming): Moving from command-based logic to a LangChain agent that understands natural language and symptoms.

🛠 Tech Stack
Runtime: Node.js

Bot API: Telegraf (Telegram Bot API)

Database Management: MongoDB Compass (Local/Manual GUI management)

Environment: Managed via .env for secure configuration.

🧑‍💻 For Contributors
1. Prerequisites
Node.js v18+

A Telegram Bot Token (from @BotFather)

MongoDB Compass installed locally or a local MongoDB connection string (mongodb://localhost:27017/medifast).