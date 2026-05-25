# MediFast AI Testing Guide

Use this guide before demos, deployments, or GitHub reviews.

## 1. Install

```bash
npm install
```

Use Node.js 18 or newer.

## 2. Configure Environment

Copy `.env.example` to `.env` and fill:

```env
TELEGRAM_BOT_TOKEN=
MONGODB_URI=mongodb://localhost:27017/medifast
LLM_PROVIDER=groq
ENABLE_LLM_SYNTHESIS=false
GROQ_API_KEY=
VECTOR_MODE=local
```

Keep LLM synthesis off for fastest deterministic testing. Turn it on only after the deterministic flows are healthy.

## 3. Run Unit and Integration Tests

```bash
npm test
```

The test suite covers routing, entity extraction, medicine lookup, catalog coverage, memory, RAG, pharmacy ranking, runtime traces, provider behavior, and product flows.

## 4. Run Diagnostics

```bash
npm run diagnose-medicines
npm run diagnose-catalog
npm run diagnose-pharmacies
npm run diagnose-rag
npm run diagnose-llm
npm run diagnose-memory
npm run production-health
```

Expected result: production health should be mostly healthy. Catalog vector coverage may still be partial until full medicine knowledge ingestion finishes.

## 5. Check Runtime Trace

```bash
npm run runtime -- "Dolo near me"
```

This prints the request path, entities, selected tools, evidence, confidence, and latency.

## 6. Data Activation

Medicine dataset import:

```bash
npm run import-medicines
```

Knowledge ingestion:

```bash
npm run ingest
```

Pharmacy import:

```bash
npm run import-pharmacies
```

Full activation helper:

```bash
npm run activate-data
```

Large catalog activation is resumable. Use:

```bash
npm run catalog-status
```

to check progress.

## 7. Telegram Manual Test Checklist

Try these messages:

```text
Dolo 650
Pregabalin
Alprax
MontekLC
bukhar ki tablet
headache tablet near me
Dolo near me
side effects of Pregabalin
Papa has BP and diabetes
medicine for papa
```

Also test:

```text
/start
/nearby
/health
/analytics
/status
/runtime
/trace
/nearby-debug
/admindebug
```

## 8. Expected Safety Behavior

The bot should:

- show confidence
- ask clarification when medicine matching is weak
- avoid dosage invention
- warn on prescription-sensitive or family-risk contexts
- say when pharmacy stock is estimated, not guaranteed
- include a short medical disclaimer

## 9. Git Checks

```bash
git diff --check
```

This catches trailing whitespace and formatting issues before pushing.

## 10. Known Pre-Test Warning

The deterministic medicine catalog can work before full vector activation is complete. RAG catalog coverage improves as ingestion progresses.

