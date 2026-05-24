# Medicine Source Drops

Put trusted CSV or JSON medicine datasets here, then run:

```bash
npm run import-medicines
```

Supported sources:

- Curated medicine CSV files
- Open drug datasets
- Government medicine datasets
- Future DrugBank-compatible exports
- Future India-specific medicine datasets

Do not add random scraped website data. Every record should have a trusted source and version.

The importer is designed for 50k+ records. This repository ships:

- `curated-india-starter.json` for demo-critical aliases like Dolo, Modalert, and Ivabrad.
- `general-essential-india-2026.json` for common India-first household and essential-medicine names, salts, brands, and aliases.

The general pack is curated from commonly used Indian pharmacy names and essential-medicine concepts, guided by India's NLEM and WHO EML categories. It is not a substitute for a licensed drug database, and prescription flags must be respected by the bot.
