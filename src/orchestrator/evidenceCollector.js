const compactMedicine = (medicine = {}) => {
  if (!medicine) return null;
  return {
    medicineName: medicine.medicineName || null,
    genericName: medicine.genericName || null,
    salts: medicine.salts?.slice?.(0, 5) || [],
    brands: medicine.brands?.slice?.(0, 5) || [],
    aliases: medicine.aliases?.slice?.(0, 5) || [],
    company: medicine.company || null,
    category: medicine.category || null,
    symptoms: medicine.symptoms?.slice?.(0, 5) || [],
    sideEffects: medicine.sideEffects?.slice?.(0, 5) || [],
    prescriptionRequired: Boolean(medicine.prescriptionRequired),
  };
};

const compactRelationships = (relationships = []) =>
  relationships.slice(0, 10).map((item) => ({
    type: item.type || item.relation || "related",
    from: item.from || item.source || item.medicine || null,
    to: item.to || item.target || item.value || null,
    confidence: item.confidence || null,
  }));

const compactMemory = (memory = {}) =>
  (memory.facts || []).slice(0, 8).map((fact) => ({
    type: fact.type,
    entity: fact.entity,
    value: fact.value,
    confidence: fact.confidence || null,
    source: fact.source || "memory",
  }));

const compactRag = (knowledge = {}) =>
  (knowledge.context || []).slice(0, 5).map((item) => ({
    text: String(item.text || "").slice(0, 700),
    confidence: item.confidence || item.score || null,
    source: item.metadata?.source || null,
    category: item.metadata?.category || null,
    trust: item.metadata?.trust || null,
  }));

const compactPharmacies = (nearby = {}) =>
  (nearby.ranked || nearby.pharmacies || []).slice(0, 5).map((pharmacy) => ({
    name: pharmacy.name,
    distanceKm: pharmacy.distanceKm,
    score: pharmacy.score,
    address: pharmacy.address,
    confidence: pharmacy.confidence,
    inventoryConfidence: pharmacy.inventoryConfidence,
  }));

const collectEvidence = ({ query = "", plan = {}, toolResults = {} } = {}) => {
  const medicineResult = toolResults.medicineKnowledge?.value || {};
  const memoryResult = toolResults.memory?.value || {};
  const knowledgeResult = toolResults.knowledge?.value || {};
  const nearbyResult = toolResults.nearby?.value || {};
  const errors = Object.fromEntries(
    Object.entries(toolResults)
      .filter(([, result]) => result.ok === false)
      .map(([name, result]) => [name, result.error])
  );

  return {
    userQuery: query,
    entities: plan.entities || {},
    routes: plan.routes || [],
    medicineContext: {
      medicine: compactMedicine(medicineResult.medicine),
      alternatives: (medicineResult.alternatives || []).slice(0, 5).map(compactMedicine),
      relationships: compactRelationships(medicineResult.relationships || []),
      message: medicineResult.message || null,
      confidence: medicineResult.confidence || 0,
    },
    memoryContext: {
      facts: compactMemory(memoryResult),
      confidence: memoryResult.confidence || 0,
    },
    pharmacyContext: {
      source: nearbyResult.ranked ? "Mongo Geo" : null,
      radiusKm: nearbyResult.radiusKm || null,
      expandedRadius: Boolean(nearbyResult.expandedRadius),
      inventoryMatchCount: nearbyResult.inventoryMatchCount || 0,
      pharmacies: compactPharmacies(nearbyResult),
    },
    ragContext: {
      context: compactRag(knowledgeResult),
      sources: (knowledgeResult.sources || []).slice(0, 5),
      confidence: knowledgeResult.confidence || 0,
      lowConfidence: Boolean(knowledgeResult.lowConfidence),
    },
    confidenceScores: {
      medicine: medicineResult.confidence || 0,
      memory: memoryResult.confidence || 0,
      rag: knowledgeResult.confidence || 0,
      pharmacy: nearbyResult.ranked?.[0]?.score || 0,
    },
    toolErrors: errors,
  };
};

const estimateEvidenceSize = (evidence) => Buffer.byteLength(JSON.stringify(evidence || {}), "utf8");

module.exports = {
  collectEvidence,
  estimateEvidenceSize,
};
