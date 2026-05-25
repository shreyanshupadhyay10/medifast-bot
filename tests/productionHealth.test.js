const test = require("node:test");
const assert = require("node:assert/strict");
const { buildProductionHealthReport } = require("../src/diagnostics/productionHealth");

test("production health report summarizes catalog, memory, rag, llm, and pharmacy status", () => {
  const report = buildProductionHealthReport({
    catalog: {
      progressCompletionPercent: 100,
      complete: true,
      vectorAvailable: true,
      vectorizedChunks: 100,
    },
    memory: { profiles: 1, vectorError: null },
    rag: { chromaAvailable: true, retrievalHits: 2 },
    llm: { synthesisEnabled: true, providerConfigured: true },
    pharmacy: { realDataActive: true, geoIndexExists: { location: true } },
  });

  assert.equal(report.status.catalog, "ok");
  assert.equal(report.status.vectors, "ok");
  assert.equal(report.status.memory, "ok");
  assert.equal(report.status.rag, "ok");
  assert.equal(report.status.llm, "ok");
  assert.equal(report.status.pharmacy, "ok");
});

test("production health marks partial catalog activation as warning", () => {
  const report = buildProductionHealthReport({
    catalog: { progressCompletionPercent: 12, complete: false, vectorAvailable: true, vectorizedChunks: 10 },
    memory: { profiles: 0, vectorError: null },
    rag: { chromaAvailable: true, retrievalHits: 0 },
    llm: { synthesisEnabled: true, providerConfigured: false },
    pharmacy: { realDataActive: false, geoIndexExists: { location: false } },
  });

  assert.equal(report.status.catalog, "warning");
  assert.equal(report.status.rag, "warning");
  assert.equal(report.status.llm, "warning");
  assert.equal(report.status.pharmacy, "attention");
});
