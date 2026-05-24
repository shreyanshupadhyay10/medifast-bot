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

The importer is designed for 50k+ records, but this repository only ships a small curated starter dataset to avoid inventing unsafe medicine information.
