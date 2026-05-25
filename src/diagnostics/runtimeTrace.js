const { extractEntities } = require("../ai/entityExtractor");
const { routeMessage } = require("../ai/router");
const { getOrCreateProfile } = require("../services/familyService");
const { getSessionLocation } = require("../pharmacy/pharmacyLocationService");
const { runMediFastWorkflow } = require("../orchestrator/orchestrator");
const { searchMedicine } = require("../services/searchService");
const { searchMedicineKnowledge } = require("../medicine/medicineKnowledgeService");

const now = () => Date.now();

const timed = async (label, fn) => {
  const startedAt = now();
  try {
    const value = await fn();
    return { label, ok: true, latencyMs: now() - startedAt, value };
  } catch (error) {
    return { label, ok: false, latencyMs: now() - startedAt, error: error.message, value: null };
  }
};

const compactRoutes = (routes = []) =>
  routes.map((route) => ({
    tool: route.tool,
    confidence: Number(route.confidence || 0),
    reason: route.reason,
  }));

const compactWorkflow = (workflow = {}) => ({
  tools: workflow.debug?.toolSequence || [],
  errors: workflow.debug?.errors || {},
  provider: workflow.generated?.provider || "deterministic",
  providerModel: workflow.generated?.model || null,
  providerLatencyMs: workflow.debug?.providerLatencyMs || 0,
  memoryHits: workflow.memory?.length || 0,
  ragHits: workflow.knowledge?.context?.length || 0,
  ragConfidence: workflow.knowledge?.confidence || 0,
  medicineConfidence: workflow.medicineConfidence || 0,
  pharmacyCount: workflow.nearby?.ranked?.length || 0,
  topPharmacy: workflow.nearby?.ranked?.[0]?.name || null,
});

const traceRuntime = async ({ query = "", from, location = null, includeInventory = true } = {}) => {
  const startedAt = now();
  const profileStep = await timed("profile", () => getOrCreateProfile(from || { id: "trace", first_name: "Trace" }));
  const profile = profileStep.value;
  const savedLocation = location || (from?.id ? await getSessionLocation(from.id) : null);
  const entities = extractEntities(query, profile);
  const routes = routeMessage({ entities, profile });
  const path = [
    "Telegram",
    "Bot handler",
    "Entity Extractor",
    "Ranked Router",
    "Tool Registry",
    "Evidence Collector",
    "Groq synthesis when enabled",
    "Safety Guard",
    "Formatter",
    "Telegram response",
  ];

  const medicineKnowledgeStep = await timed("medicineKnowledge", () => searchMedicineKnowledge({ query: entities.medicine || entities.normalizedMedicineQuery || query }));
  const inventoryStep = includeInventory
    ? await timed("inventorySearch", () => searchMedicine(entities.medicine || entities.normalizedMedicineQuery || query))
    : null;
  const workflowStep = await timed("workflow", () =>
    runMediFastWorkflow({
      query,
      profile,
      telegramId: from?.id,
      location: savedLocation,
    })
  );

  return {
    query,
    path,
    entities,
    routes: compactRoutes(routes),
    selectedTools: workflowStep.value?.debug?.toolSequence || [],
    evidence: {
      medicine: medicineKnowledgeStep.value?.medicine
        ? {
            name: medicineKnowledgeStep.value.medicine.medicineName,
            generic: medicineKnowledgeStep.value.medicine.genericName,
            confidence: medicineKnowledgeStep.value.confidence,
          }
        : null,
      suggestions: medicineKnowledgeStep.value?.suggestions || [],
      inventoryResults: inventoryStep?.value?.results?.length || 0,
      memoryHits: workflowStep.value?.memory?.length || 0,
      ragHits: workflowStep.value?.knowledge?.context?.length || 0,
      pharmacies: workflowStep.value?.nearby?.ranked?.slice(0, 3).map((item) => ({
        name: item.name,
        distance: item.distance,
        score: item.score,
        inventoryConfidence: item.inventoryConfidence,
        source: item.source,
      })) || [],
    },
    confidence: {
      medicine: medicineKnowledgeStep.value?.confidence || 0,
      rag: workflowStep.value?.knowledge?.confidence || 0,
      pharmacy: workflowStep.value?.nearby?.ranked?.[0]?.score || 0,
    },
    latency: {
      profileMs: profileStep.latencyMs,
      medicineKnowledgeMs: medicineKnowledgeStep.latencyMs,
      inventoryMs: inventoryStep?.latencyMs || 0,
      workflowMs: workflowStep.latencyMs,
      totalMs: now() - startedAt,
    },
    workflow: compactWorkflow(workflowStep.value),
    errors: [profileStep, medicineKnowledgeStep, inventoryStep, workflowStep]
      .filter((step) => step && !step.ok)
      .map((step) => ({ step: step.label, error: step.error })),
  };
};

const formatRuntimeTrace = (trace = {}, escapeHtml = (value) => String(value || "")) => {
  const topEvidence = trace.evidence?.medicine
    ? `${trace.evidence.medicine.name || trace.evidence.medicine.generic} (${Math.round((trace.evidence.medicine.confidence || 0) * 100)}%)`
    : "not confident";
  const pharmacyLine = trace.evidence?.pharmacies?.length
    ? trace.evidence.pharmacies.map((item) => `${item.name} ${Math.round((item.score || 0) * 100)}%`).join(", ")
    : "none";
  return (
    `🧭 <b>MediFast Runtime Trace</b>\n\n` +
    `Query: <code>${escapeHtml(trace.query)}</code>\n` +
    `Path: ${escapeHtml((trace.path || []).join(" → "))}\n\n` +
    `<b>Entities</b>\n<code>${escapeHtml(JSON.stringify({
      person: trace.entities?.person,
      symptom: trace.entities?.symptom,
      medicine: trace.entities?.medicine,
      intentType: trace.entities?.intentType,
      nearby: trace.entities?.nearbyIntent,
    }, null, 2))}</code>\n\n` +
    `<b>Tools</b>\n${escapeHtml((trace.selectedTools || []).join(" → ") || "none")}\n\n` +
    `<b>Evidence</b>\n` +
    `Medicine: <b>${escapeHtml(topEvidence)}</b>\n` +
    `Inventory results: <b>${trace.evidence?.inventoryResults || 0}</b>\n` +
    `Memory hits: <b>${trace.evidence?.memoryHits || 0}</b>\n` +
    `RAG hits: <b>${trace.evidence?.ragHits || 0}</b>\n` +
    `Pharmacies: ${escapeHtml(pharmacyLine)}\n\n` +
    `<b>Latency</b>\n` +
    `Total: <b>${trace.latency?.totalMs || 0}ms</b> · Workflow: <b>${trace.latency?.workflowMs || 0}ms</b> · Provider: <b>${trace.workflow?.providerLatencyMs || 0}ms</b>\n\n` +
    `<b>Provider</b>\n${escapeHtml(trace.workflow?.provider || "deterministic")} ${escapeHtml(trace.workflow?.providerModel || "")}`
  );
};

module.exports = {
  formatRuntimeTrace,
  traceRuntime,
};
