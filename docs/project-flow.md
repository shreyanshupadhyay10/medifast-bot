# MediFast AI Project Flow

This document explains how the system behaves in practical user journeys.

## 1. Welcome Flow

```text
/start
  -> language selection
  -> location permission prompt
  -> optional family setup
  -> example prompts
```

The public Telegram bot name is controlled in BotFather. The repository product name is MediFast AI.

## 2. Medicine Lookup

Example:

```text
Dolo 650
```

Flow:

```text
Telegram message
  -> entity extraction
  -> router ranks medicine_lookup
  -> medicine normalizer checks exact, alias, brand, salt, fuzzy, semantic
  -> MedicineKnowledge lookup
  -> inventory search through Fuse.js where applicable
  -> safety guard
  -> formatted response
```

Expected response includes the medicine name, generic salt, category, confidence, alternatives where available, and safety note.

## 3. Hinglish Symptom Query

Example:

```text
bukhar ki tablet
```

Flow:

```text
Entity extractor maps bukhar to fever
  -> router ranks symptom_lookup and medicine_lookup
  -> medicine knowledge searches category and symptom relationships
  -> response explains safe discovery results
```

The bot should avoid pretending to prescribe. It can help discover likely medicine categories and ask follow-up questions when confidence is low.

## 4. Side-Effect Query

Example:

```text
side effects of Pregabalin
```

Flow:

```text
Entity extractor detects side_effects intent and Pregabalin
  -> router selects medicine knowledge and RAG
  -> MedicineKnowledge retrieves side-effect fields
  -> RAG retrieves supporting context
  -> evidence collector combines both
  -> provider synthesis if enabled
  -> safety guard
```

The LLM is allowed to summarize evidence. It is not allowed to invent side effects.

## 5. Nearby Pharmacy Search

Example:

```text
Dolo near me
```

Flow:

```text
Entity extractor detects Dolo and nearby intent
  -> medicine normalizer maps Dolo to Paracetamol
  -> if location is missing, Telegram shows Share Location button
  -> if location is available, Mongo geospatial search runs
  -> radius starts near 5 km and can expand
  -> pharmacies are ranked by distance, source confidence, popularity, and medicine confidence
  -> response shows name, distance, address, phone, source, and action buttons
```

If no real pharmacy data exists near the user, the bot should say no nearby pharmacies were found instead of returning dummy entries.

## 6. Family and Memory Flow

Example:

```text
Papa has BP and diabetes
```

Flow:

```text
Entity extractor detects person and conditions
  -> memory service stores structured facts
  -> family profile can connect papa to an actual member
  -> future query "medicine for papa" retrieves those facts
```

Memory is used to add context, warnings, and follow-up suggestions. It does not replace medical judgment.

## 7. RAG Activation Flow

Knowledge files live under:

```text
knowledge-base/
  medicines/
  side_effects/
  symptoms/
  drug_interactions/
  guidelines/
  faq/
```

Run:

```bash
npm run ingest
```

This loads files, chunks them, embeds them, and stores vectors in Chroma or local vector mode.

MedicineKnowledge can also be activated into RAG through the catalog ingestion pipeline, which is resumable and batch-based.

## 8. Diagnostics Flow

Useful commands:

```bash
npm run catalog-status
npm run diagnose-rag
npm run diagnose-llm
npm run diagnose-memory
npm run production-health
npm run runtime -- "Dolo near me"
```

These commands are designed to make product demos and debugging easier.

