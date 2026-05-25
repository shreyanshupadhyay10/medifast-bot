const test = require("node:test");
const assert = require("node:assert/strict");
const { diagnoseDeadCode } = require("../src/diagnostics/deadCodeDiagnostics");
const { buildProductionHealthReport } = require("../src/diagnostics/productionHealth");
const { formatRuntimeTrace } = require("../src/diagnostics/runtimeTrace");
const { formatProductionHealth } = require("../src/utils/formatter");

test("runtime trace formatter exposes path, tools, evidence, latency, and provider", () => {
  const message = formatRuntimeTrace(
    {
      query: "Dolo near me",
      path: ["Telegram", "Entity Extractor", "Router", "Formatter"],
      entities: { medicine: "Dolo", intentType: "nearby", nearbyIntent: true },
      selectedTools: ["searchMedicineKnowledge", "recommendNearbyPharmacies"],
      evidence: {
        medicine: { name: "Dolo 650", generic: "Paracetamol", confidence: 0.92 },
        inventoryResults: 1,
        memoryHits: 0,
        ragHits: 1,
        pharmacies: [{ name: "Apollo Pharmacy", score: 0.83 }],
      },
      latency: { totalMs: 120, workflowMs: 80 },
      workflow: { provider: "groq", providerModel: "llama", providerLatencyMs: 44 },
    },
    (value) => String(value || "")
  );

  assert.match(message, /Runtime Trace/);
  assert.match(message, /Dolo near me/);
  assert.match(message, /searchMedicineKnowledge/);
  assert.match(message, /Apollo Pharmacy/);
  assert.match(message, /Provider/);
});

test("production health supports code/dead-code status", () => {
  const report = buildProductionHealthReport({
    catalog: { complete: true, progressCompletionPercent: 100, vectorAvailable: true, vectorizedChunks: 10 },
    memory: { profiles: 1 },
    rag: { chromaAvailable: true, retrievalHits: 1 },
    llm: { providerConfigured: true },
    pharmacy: { realDataActive: true, geoIndexExists: { location: true } },
    deadCode: { candidateCount: 0 },
  });

  assert.equal(report.status.code, "ok");
  assert.match(formatProductionHealth(report), /Dead-code candidates/);
});

test("dead-code diagnostics scans source files without failing the app", () => {
  const report = diagnoseDeadCode();

  assert.equal(report.scannedFiles > 0, true);
  assert.equal(Array.isArray(report.candidates), true);
});
