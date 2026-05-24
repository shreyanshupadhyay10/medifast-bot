const { normalizeQuery } = require("../../services/intentEngine");
const { normalizeMedicineRecord } = require("../medicineNormalizer");

const unique = (items = []) => [...new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];

const mergeRecord = (existing, incoming) => ({
  ...existing,
  medicineName: existing.medicineName || incoming.medicineName,
  genericName: existing.genericName || incoming.genericName,
  salts: unique([...(existing.salts || []), ...(incoming.salts || [])]),
  brands: unique([...(existing.brands || []), ...(incoming.brands || [])]),
  aliases: unique([...(existing.aliases || []), ...(incoming.aliases || [])]),
  alternatives: unique([...(existing.alternatives || []), ...(incoming.alternatives || [])]),
  company: existing.company || incoming.company,
  category: existing.category !== "other" ? existing.category : incoming.category,
  symptoms: unique([...(existing.symptoms || []), ...(incoming.symptoms || [])]),
  sideEffects: unique([...(existing.sideEffects || []), ...(incoming.sideEffects || [])]),
  precautions: unique([...(existing.precautions || []), ...(incoming.precautions || [])]),
  prescriptionRequired: Boolean(existing.prescriptionRequired || incoming.prescriptionRequired),
  commonSpellings: unique([...(existing.commonSpellings || []), ...(incoming.commonSpellings || [])]),
  confidence: Math.max(existing.confidence || 0, incoming.confidence || 0),
  source: unique([existing.source, incoming.source]).join("|"),
  sourceMetadata: {
    trustLevel: existing.sourceMetadata?.trustLevel || incoming.sourceMetadata?.trustLevel || "unknown",
    importedAt: new Date(),
    datasetVersion: unique([
      existing.sourceMetadata?.datasetVersion,
      incoming.sourceMetadata?.datasetVersion,
    ]).join("|") || "unknown",
  },
});

const identityFor = (record) =>
  record.knowledgeKey ||
  (record.sourceKind === "product_catalog"
    ? normalizeQuery([record.medicineName, record.genericName, record.company].filter(Boolean).join(" "))
    : normalizeQuery(record.genericName || record.salts?.join(" ") || record.medicineName || record.brands?.[0]));

const mergeDataset = (records = [], defaults = {}) => {
  const map = new Map();
  let duplicateCount = 0;

  records.map((record) => normalizeMedicineRecord(record, defaults)).forEach((record) => {
    const key = identityFor(record);
    if (!key) return;
    if (map.has(key)) {
      duplicateCount += 1;
      map.set(key, mergeRecord(map.get(key), record));
    } else {
      map.set(key, record);
    }
  });

  return {
  records: [...map.values()],
    duplicateCount,
  };
};

module.exports = {
  identityFor,
  mergeDataset,
  mergeRecord,
};
