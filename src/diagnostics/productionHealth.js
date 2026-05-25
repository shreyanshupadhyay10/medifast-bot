const AnalyticsEvent = require("../models/AnalyticsEvent");
const { diagnoseCatalog } = require("../medicine/diagnostics/catalogDiagnostics");
const { diagnoseMemory } = require("../memory/memoryDiagnostics");
const { diagnosePharmacies } = require("../pharmacy/diagnostics/pharmacyDiagnostics");
const { diagnoseRag } = require("../rag/ragDiagnostics");
const { diagnoseDeadCode } = require("./deadCodeDiagnostics");

const statusFor = ({ ok, warn = false } = {}) => (ok ? "ok" : warn ? "warning" : "attention");

const buildProductionHealthReport = ({ catalog, memory, rag, llm, pharmacy, deadCode } = {}) => ({
  status: {
    catalog: statusFor({ ok: catalog?.complete || catalog?.progressCompletionPercent >= 95, warn: catalog?.progressCompletionPercent > 0 }),
    vectors: statusFor({ ok: catalog?.vectorAvailable && catalog?.vectorizedChunks > 0 }),
    memory: statusFor({ ok: memory?.profiles >= 0 && !memory?.vectorError }),
    rag: statusFor({ ok: rag?.chromaAvailable && rag?.retrievalHits > 0, warn: rag?.chromaAvailable }),
    llm: statusFor({ ok: Boolean(llm?.providerConfigured), warn: llm?.synthesisEnabled }),
    pharmacy: statusFor({ ok: pharmacy?.realDataActive && pharmacy?.geoIndexExists?.location }),
    code: statusFor({ ok: !deadCode || deadCode.candidateCount <= Number(process.env.DEAD_CODE_WARNING_LIMIT || 25) }),
  },
  catalog,
  memory,
  rag,
  llm,
  pharmacy,
  deadCode,
});

const diagnoseLlm = async () => {
  const [orchestrationCount, groqUsage, latest] = await Promise.all([
    AnalyticsEvent.countDocuments({ eventType: "orchestration.completed" }),
    AnalyticsEvent.countDocuments({ eventType: "llm.groq.used" }),
    AnalyticsEvent.findOne({ eventType: "orchestration.completed" }).sort({ createdAt: -1 }).lean(),
  ]);
  return {
    provider: process.env.LLM_PROVIDER || process.env.AI_PROVIDER || "deterministic",
    synthesisEnabled: process.env.ENABLE_LLM_SYNTHESIS === "true",
    providerConfigured: Boolean(process.env.GROQ_API_KEY) || (process.env.LLM_PROVIDER || process.env.AI_PROVIDER) !== "groq",
    model: process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
    timeoutMs: Number(process.env.GROQ_TIMEOUT_MS || 4500),
    orchestrationCount,
    groqUsage,
    latest: latest?.metadata || null,
  };
};

const diagnoseProductionHealth = async () => {
  const [catalog, memory, rag, llm, pharmacy] = await Promise.all([
    diagnoseCatalog(),
    diagnoseMemory(),
    diagnoseRag({ query: "fever medicine safety" }),
    diagnoseLlm(),
    diagnosePharmacies(),
  ]);
  const deadCode = diagnoseDeadCode();
  return buildProductionHealthReport({ catalog, memory, rag, llm, pharmacy, deadCode });
};

module.exports = {
  buildProductionHealthReport,
  diagnoseLlm,
  diagnoseProductionHealth,
};
