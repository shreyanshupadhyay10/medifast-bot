# MediFast AI

India-first medicine assistant for Telegram.

MediFast AI helps users search medicines, understand simple Hindi/Hinglish symptom queries, manage family medicine needs, discover nearby pharmacies, and reuse medicine history safely.

This project started as a Jaipur medicine availability Telegram bot. It has now been upgraded into a production-safe MVP with AI-ready architecture, medicine knowledge, side-effect enrichment, semantic retrieval, and real nearby pharmacy discovery.

Medical safety note: this bot helps users discover medicine information and pharmacy availability. It is not a replacement for a doctor.

## What The Bot Can Do

- Search medicines from live pharmacy inventory.
- Understand Hinglish and Hindi style queries like `bukhar ki tablet`, `sar dard`, `gas acidity`, and `Dolo near me`.
- Recognize Indian brand names, salts, aliases, and common spellings.
- Store family profiles for people like papa, mummy, child, or senior family members.
- Suggest repeat/reorder flows using recent search history.
- Use Telegram shared location to find nearby pharmacies.
- Rank pharmacies by distance, inventory match, and confidence.
- Import Jaipur pharmacy POIs from OpenStreetMap into MongoDB.
- Expand the same pharmacy import system to Delhi, Mumbai, Kota, and more cities.
- Keep medicine inventory separate from medicine knowledge.
- Import large Indian medicine datasets into MongoDB.
- Enrich medicine records with side-effect data from trusted CSV files.
- Store unmatched/low-confidence enrichment rows separately for review.
- Run RAG over trusted knowledge files using Chroma.
- Store structured conversation memory and semantic memory.
- Track analytics for searches, retrieval, pharmacy usage, imports, and enrichment.
- Diagnose whether real medicine and pharmacy datasets are active in production.
- Keep deterministic search and safety guardrails as the default.

## Important Telegram Name Note

The public Telegram bot name is controlled in BotFather, not in this repo.

If Telegram still shows `jaipu medicine bot`, rename it in BotFather:

```text
/setname
```

The code and README now call the product `MediFast AI`.

## Main Upgrade Summary

### 1. AI-Ready Router

The bot now has a ranked router instead of one hard route.

Example:

```js
[
  { tool: "family", confidence: 0.91 },
  { tool: "medicine", confidence: 0.88 },
  { tool: "memory", confidence: 0.84 },
  { tool: "nearby", confidence: 0.80 }
]
```

This keeps the current system fast and deterministic, while making future LangChain or open-source LLM orchestration easier.

### 2. Entity Extraction

The bot extracts useful entities from user text:

```js
{
  person: "papa",
  symptom: "fever",
  duration: "1 day",
  medicine: "dolo",
  nearbyIntent: true,
  reorderIntent: false
}
```

### 3. Hinglish And Hindi Search

Examples users can type:

```text
Sar dard ki dawa chaiye
Bukhar ki tablet
Pet dard medicine
Khansi ke liye kuch
Zukham dawa
Fever medicine for child
Gas acidity tablet
Dolo near me
```

The intent engine maps common words like:

```text
sar dard -> headache
bukhar -> fever
khansi -> cough
zukham -> cold
pet dard -> stomach pain
gas -> acidity
ulti -> nausea
```

### 4. Family Profiles

Users can save family members:

```text
/family
/addmember
/members
/removeMember
```

Add a member:

```text
Papa|papa|senior|diabetes and BP
```

The schema supports:

- name
- relation
- age group
- notes
- guardian name
- guardian Telegram ID
- guardian notification flag

Example queries:

```text
papa fever medicine
reorder papa medicine
mom acidity tablet
```

### 5. Medicine Knowledge Layer

Inventory and medicine knowledge are separate.

```text
Inventory = stock, price, quantity, pharmacy availability
MedicineKnowledge = generic name, salts, brands, aliases, side effects, category, source
```

This lets the bot understand medicine names even when a local pharmacy inventory does not have every record.

### 6. Indian Medicine Dataset Import

The importer supports trusted CSV and JSON files.

It auto-detects fields instead of assuming column names.

For the uploaded Indian medicine dataset, it detected:

```text
name -> medicine name / brand
short_composition1 -> salt
short_composition2 -> salt
manufacturer_name -> company
type -> category
```

The dataset imported successfully into local MongoDB:

```text
Raw records: 253,973
Valid records: 253,973
Failed records: 0
Duplicate removals: 2,937
Imported/updated: 251,036
```

Run the importer:

```bash
npm run import-medicines -- "C:\Users\Ruchin Audichya\Desktop\Indian-Medicine-Dataset-main\DATA\indian_medicine_data.csv"
```

You can also drop trusted CSV/JSON files into:

```text
data/medicine-sources/
```

Then run:

```bash
npm run import-medicines
```

This repo also includes a curated general medicine pack:

```text
data/medicine-sources/general-essential-india-2026.json
```

It adds common India-first medicine names, salts, brands, spellings, and aliases across fever/pain, allergy/cold, cough, gastro, diabetes, BP/cardiac, antibiotics, dermatology, vitamins, eye/ear, women's health, and neurological categories.

Import only this pack:

```bash
npm run import-medicines -- data/medicine-sources/general-essential-india-2026.json
```

### 7. Side-Effects Enrichment

The side-effects enrichment pipeline uses a trusted CSV and merges side-effect text into existing `MedicineKnowledge` records.

For the uploaded Drugs.com CSV, it detected:

```json
{
  "medicineName": "drug_name",
  "genericName": "generic_name",
  "sideEffects": "side_effects",
  "source": "drug_link",
  "brand": "brand_names"
}
```

Run enrichment:

```bash
npm run enrich-side-effects -- "C:\Users\Ruchin Audichya\Desktop\drugs_side_effects_drugs_com.csv"
```

Latest enrichment after match improvements:

```text
Matched records: 1,339
Unmatched records: 1,592
Match rate: 0.477
Enriched medicine docs: 169,436
Stored unmatched review rows: 1,045
Side-effect entries: 681,776
```

Low-confidence rows are not guessed. They are stored in `UnmatchedMedicineEnrichment` for review.

### 8. Medicine Matcher

The matcher ranks medicine matches in this order:

```text
genericName
salts
brands
aliases
commonSpellings
synonyms
optional fuzzy matching
optional semantic matching
```

Synonyms live in:

```text
data/medicineSynonyms.json
```

Examples:

```text
Tylenol -> Paracetamol
Acetaminophen -> Paracetamol
Azithral -> Azithromycin
Accutane -> Isotretinoin
```

Fuzzy and semantic matching are available but off by default for big batch enrichment:

```env
SIDE_EFFECTS_FUZZY_MATCHING=false
SIDE_EFFECTS_SEMANTIC_MATCHING=false
MEDICINE_MATCHER_FUZZY_CANDIDATE_LIMIT=500
```

### 9. Real Nearby Pharmacy Discovery

Users can run:

```text
/nearby
```

Or type:

```text
Dolo near me
Crocin pharmacy nearby
Azithral 500 near me
```

If the bot does not have location yet, it shows a Telegram `Share Location` button.

Search flow:

```text
Telegram location
-> 5 km pharmacy search
-> expand to 10 km if too few results
-> inventory matching
-> ranking
-> response
```

Ranking formula:

```text
score = distanceScore * 0.5 + inventoryScore * 0.3 + pharmacyConfidence * 0.2
```

The response shows:

- pharmacy name
- distance
- ranking score
- inventory confidence
- inventory matches
- phone
- address

### 10. Jaipur Pharmacy Auto Import

The bot can now build its own Jaipur pharmacy database from OpenStreetMap POIs.

Flow:

```text
OpenStreetMap Overpass API
-> pharmacy POIs around Jaipur
-> validation
-> normalization
-> duplicate removal
-> MongoDB Pharmacy collection
-> 2dsphere index
-> analytics event
```

Default city config lives in:

```text
config/cities.js
```

Run Jaipur import:

```bash
npm run import-pharmacies
```

Import another supported city:

```bash
npm run import-pharmacies -- Delhi
npm run import-pharmacies -- Mumbai
npm run import-pharmacies -- Kota
```

The importer stores source metadata on each pharmacy:

```js
{
  source: "OpenStreetMap",
  importedAt: Date,
  trustLevel: "medium",
  datasetVersion: "..."
}
```

No random website scraping is used.

### 11. RAG And Semantic Memory

Knowledge files live in:

```text
knowledge-base/
  medicines/
  side_effects/
  symptoms/
  drug_interactions/
  guidelines/
  faq/
```

RAG flow:

```text
knowledge-base
-> document loader
-> chunker
-> local embeddings
-> Chroma
-> hybrid retriever
-> reranker
-> provider.generate()
```

Run knowledge ingestion:

```bash
npm run ingest
```

Start Chroma locally first if using vector retrieval:

```bash
docker run -p 8000:8000 chromadb/chroma
```

### 12. Analytics

Admin command:

```text
/analytics
```

Tracks:

- top medicines
- top symptom intents
- repeat searches
- SOS trends
- retrieval usage
- medicine import stats
- side-effect enrichment stats
- nearby searches
- location permissions
- pharmacy ranking usage
- inventory matches
- latest pharmacy import
- duplicate pharmacy removals
- coordinate issues
- medicine normalization confidence distribution
- top unknown medicine queries

## Project Structure

```text
src/
  ai/
    entityExtractor.js
    router.js
    safetyGuard.js
    toolRegistry.js

  bot/
    commands/
      admin.js
      family.js
      nearby.js
      search.js
      sos.js

  cache/
    medicineCache.js

  events/
    eventBus.js
    listeners/

  memory/
    memorySummarizer.js
    semanticMemory.js

  medicine/
    enrichment/
      sideEffectsEnricher.js
      sideEffectsMapper.js
    matching/
      confidenceScorer.js
      medicineMatcher.js
    sources/
      datasetMerger.js
      datasetValidator.js
      fieldMapper.js
      sourceManager.js
    medicineImporter.js
    medicineKnowledgeService.js
    medicineNormalizer.js
    medicineRelationshipService.js

  pharmacy/
    pharmacyAvailabilityService.js
    pharmacyLocationService.js
    pharmacyRankingService.js
    pharmacyRecommendationService.js
    pharmacySearchService.js
    sources/
      sourceManager.js
      osmPharmacySource.js
      datasetValidator.js
      datasetNormalizer.js
      datasetMerger.js

  rag/
    chunker.js
    documentLoader.js
    embeddingProvider.js
    embeddings.js
    evaluator.js
    hybridRetriever.js
    reranker.js
    retriever.js

  services/
    analyticsService.js
    familyService.js
    historyService.js
    intentEngine.js
    memoryService.js
    nearbyPharmacyService.js
    ragService.js
    searchService.js

  models/
    AnalyticsEvent.js
    ConversationMemory.js
    Inventory.js
    MedicineKnowledge.js
    Pharmacy.js
    PharmacySearchHistory.js
    RetrievalMetric.js
    SearchHistory.js
    SosRequest.js
    UnmatchedMedicineEnrichment.js
    UserProfile.js
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create `.env`

Copy `.env.example` to `.env`:

```bash
copy .env.example .env
```

Fill in:

```env
TELEGRAM_BOT_TOKEN=your_token_from_botfather
MONGODB_URI=mongodb://localhost:27017/medifast
PORT=3001

NEARBY_RADIUS_KM=5
NEARBY_MAX_RADIUS_KM=10
NEARBY_MIN_RESULTS=3
PHARMACY_IMPORT_CITY=Jaipur
OVERPASS_URL=https://overpass-api.de/api/interpreter

AI_PROVIDER=deterministic
AI_DEBUG=false

VECTOR_DB=chroma
CHROMA_URL=http://localhost:8000
CHROMA_KNOWLEDGE_COLLECTION=medifast_knowledge
CHROMA_MEMORY_COLLECTION=medifast_memory

EMBEDDING_PROVIDER=local
LOCAL_EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2

RETRIEVAL_SEMANTIC_WEIGHT=0.55
RETRIEVAL_KEYWORD_WEIGHT=0.35
RETRIEVAL_CATEGORY_WEIGHT=0.10
RETRIEVAL_CONFIDENCE_THRESHOLD=0.45

MEDICINE_KNOWLEDGE_CONFIDENCE_THRESHOLD=0.55
LIVE_MEDICINE_SEMANTIC_MATCHING=true
MEDICINE_IMPORT_BATCH_SIZE=1000
MEDICINE_KNOWLEDGE_INDEX_LIMIT=300000

SIDE_EFFECTS_AUTO_MERGE_CONFIDENCE=0.8
SIDE_EFFECTS_UNMATCHED_CONFIDENCE=0.5
SIDE_EFFECTS_FUZZY_MATCHING=false
SIDE_EFFECTS_SEMANTIC_MATCHING=false
MEDICINE_MATCHER_FUZZY_CANDIDATE_LIMIT=500
```

### 3. Start MongoDB

For local MongoDB / Compass:

```text
mongodb://localhost:27017/medifast
```

### 4. Seed Demo Data

```bash
npm run seed
```

### 5. Import Indian Medicine Dataset

```bash
npm run import-medicines -- "C:\Users\Ruchin Audichya\Desktop\Indian-Medicine-Dataset-main\DATA\indian_medicine_data.csv"
```

Validate the imported medicine knowledge:

```bash
npm run diagnose-medicines
```

### 6. Enrich Side Effects

```bash
npm run enrich-side-effects -- "C:\Users\Ruchin Audichya\Desktop\drugs_side_effects_drugs_com.csv"
```

### 7. Optional: Start Chroma For RAG

```bash
docker run -p 8000:8000 chromadb/chroma
```

Then:

```bash
npm run ingest
```

### 8. Import Jaipur Pharmacies

```bash
npm run import-pharmacies
```

For another city:

```bash
npm run import-pharmacies -- Delhi
```

Validate active pharmacy data:

```bash
npm run diagnose-pharmacies
```

### 9. Run Production Diagnostics

```bash
npm run diagnose-medicines
npm run diagnose-pharmacies
```

### 10. Start The Bot

```bash
npm start
```

For development:

```bash
npm run dev
```

## Common Telegram Commands

```text
/start
/help
/search Dolo
/nearby
/family
/addmember
/members
/removeMember Papa
/sos rare medicine name
/analytics
/admindebug Dolo near me
```

Natural examples:

```text
bukhar ki tablet
sar dard ki dawa
gas acidity tablet
papa fever medicine
reorder papa medicine
Dolo near me
```

## Database Collections

Existing collections:

- pharmacies
- inventories
- sosrequests

New / upgraded collections:

- userprofiles
- searchhistories
- conversationmemories
- analyticsevents
- retrievalmetrics
- medicineknowledges
- unmatchedmedicineenrichments
- pharmacysearchhistories

No manual migration is required. Mongoose creates new collections and optional fields when used.

Pharmacy geo support creates sparse `2dsphere` indexes on both:

```js
{ location: "2dsphere" }
{ geoLocation: "2dsphere" }
```

Existing pharmacy records using `geoLocation` still work.

## Tests

Run:

```bash
npm test
```

Current coverage includes:

- entity extraction
- router decisions
- medicine search fallback
- medicine import mapping
- medicine matcher
- medicine knowledge diagnostics
- pharmacy diagnostics
- semantic matching
- side-effect enrichment
- RAG chunking and retrieval scoring
- pharmacy location handling
- pharmacy ranking
- nearby workflow formatting
- OpenStreetMap pharmacy source parsing
- pharmacy import normalization and deduplication

## Medical Safety

MediFast AI does not diagnose users.

It should:

- help users discover medicines and availability
- avoid inventing medicine information
- keep low-confidence rows unmatched
- show doctor/pharmacist safety disclaimers
- avoid casual prescription recommendations

## Future Scale Ideas

- WhatsApp bot integration.
- Pharmacist web dashboard.
- Live stock sync with pharmacy POS systems.
- Google Maps Places integration.
- Open-source LLM fallback for low-confidence intent only.
- Indic-language model support for better Hindi/Hinglish.
- Refill reminders for chronic medicines.
- Family guardian alerts for medicine orders.
- Order handoff to pharmacy WhatsApp.
- Shortage heatmaps and pharmacy demand analytics.

The AI direction should stay cost-conscious. OpenAI is not required for the current MVP. A cheaper open-source LLM can be added later through the existing provider and tool registry layers.
