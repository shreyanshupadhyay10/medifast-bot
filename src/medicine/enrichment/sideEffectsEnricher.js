const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const MedicineKnowledge = require("../../models/MedicineKnowledge");
const UnmatchedMedicineEnrichment = require("../../models/UnmatchedMedicineEnrichment");
const eventBus = require("../../events/eventBus");
const { normalizeQuery } = require("../../services/intentEngine");
const { rebuildMedicineKnowledgeIndex } = require("../medicineNormalizer");
const {
  buildMedicineMatcherIndex,
  candidateTermsForRecord,
  matchMedicine,
} = require("../matching/medicineMatcher");
const {
  detectSideEffectsFieldMap,
  mapSideEffectsRecord,
  validateSideEffectsRecord,
} = require("./sideEffectsMapper");

const AUTO_MERGE_CONFIDENCE = Number(process.env.SIDE_EFFECTS_AUTO_MERGE_CONFIDENCE || 0.8);
const UNMATCHED_CONFIDENCE = Number(process.env.SIDE_EFFECTS_UNMATCHED_CONFIDENCE || 0.5);

const readSideEffectsSource = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  if (/\.json$/i.test(filePath)) {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed.records || [];
  }
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
};

const sideEffectKey = (value = "") => normalizeQuery(value).slice(0, 220);

const unmatchedKeyFor = ({ record, sourceFile }) => {
  const normalizedIdentity = normalizeQuery(record.genericName || record.medicineName || (record.brands || []).join(" "));
  return sideEffectKey(["side_effects", sourceFile, normalizedIdentity, record.sideEffects].filter(Boolean).join(" "));
};

const buildSideEffectEntry = (record, confidence) => ({
  effect: record.sideEffects,
  severity: record.severity || null,
  frequency: record.frequency || null,
  source: record.source || null,
  confidence,
});

const storeUnmatched = async ({ record, sourceFile, confidence, reason }) => {
  const normalizedIdentity = normalizeQuery(record.genericName || record.medicineName || (record.brands || []).join(" "));
  const key = unmatchedKeyFor({ record, sourceFile });
  await UnmatchedMedicineEnrichment.updateOne(
    { key },
    {
      $set: {
        enrichmentType: "side_effects",
        sourceFile,
        rawIdentity: record.medicineName || record.genericName || (record.brands || []).join(", "),
        normalizedIdentity,
        confidence,
        reason,
        payload: record,
      },
    },
    { upsert: true }
  );
};

const clearUnmatched = ({ record, sourceFile }) =>
  UnmatchedMedicineEnrichment.deleteOne({
    key: unmatchedKeyFor({ record, sourceFile }),
  });

const enrichSideEffectsFromFile = async ({ filePath, records = null } = {}) => {
  if (!filePath) throw new Error("filePath is required for side effects enrichment.");

  const rawRecords = records || readSideEffectsSource(filePath);
  const headers = rawRecords[0] ? Object.keys(rawRecords[0]) : [];
  const fieldMap = detectSideEffectsFieldMap(headers);
  const sourceFile = path.basename(filePath);
  const mappedRecords = rawRecords.map((record) => mapSideEffectsRecord(record, fieldMap));
  const valid = [];
  const failed = [];

  mappedRecords.forEach((record, index) => {
    const validation = validateSideEffectsRecord(record);
    if (validation.valid) valid.push(record);
    else failed.push({ index, record, errors: validation.errors });
  });

  const medicines =
    records && records.__medicineRecords
      ? records.__medicineRecords
      : await MedicineKnowledge.find(
        {},
        "medicineName genericName salts brands aliases commonSpellings sideEffects knowledgeKey"
      ).lean();
  const matchIndex = buildMedicineMatcherIndex(medicines);

  let matchedRecords = 0;
  let unmatchedRecords = failed.length;
  let lowConfidenceRecords = 0;
  let sideEffectsAdded = 0;
  let confidenceTotal = 0;
  const matchMethods = {};
  const confidenceDistribution = {
    high: 0,
    medium: 0,
    low: failed.length,
  };

  for (const record of valid) {
    const match = await matchMedicine(record, matchIndex, {
      useFuzzy: process.env.SIDE_EFFECTS_FUZZY_MATCHING === "true",
      useSemantic: process.env.SIDE_EFFECTS_SEMANTIC_MATCHING === "true",
    });
    confidenceTotal += match.confidence;
    matchMethods[match.method] = (matchMethods[match.method] || 0) + 1;

    if (match.confidence >= AUTO_MERGE_CONFIDENCE) {
      confidenceDistribution.high += 1;
      matchedRecords += 1;
      const entry = buildSideEffectEntry(record, match.confidence);
      const result = await MedicineKnowledge.updateMany(
        {
          _id: { $in: match.medicines.map((medicine) => medicine._id).filter(Boolean) },
          "sideEffects.effect": { $ne: entry.effect },
        },
        { $addToSet: { sideEffects: entry } }
      );
      sideEffectsAdded += result.modifiedCount || 0;
      await clearUnmatched({ record, sourceFile });
      continue;
    }

    unmatchedRecords += 1;
    if (match.confidence >= UNMATCHED_CONFIDENCE) {
      lowConfidenceRecords += 1;
      confidenceDistribution.medium += 1;
    } else {
      confidenceDistribution.low += 1;
    }
    await storeUnmatched({
      record,
      sourceFile,
      confidence: match.confidence,
      reason: match.reason,
    });
  }

  const index = await rebuildMedicineKnowledgeIndex();
  const summary = {
    sourceFile,
    fieldMap,
    rawRecords: rawRecords.length,
    validRecords: valid.length,
    failedRecords: failed.length,
    matchedRecords,
    unmatchedRecords,
    lowConfidenceRecords,
    sideEffectsAdded,
    averageConfidence: valid.length ? Number((confidenceTotal / valid.length).toFixed(3)) : 0,
    matchRate: valid.length ? Number((matchedRecords / valid.length).toFixed(3)) : 0,
    matchMethods,
    confidenceDistribution,
    relationshipGrowth: sideEffectsAdded * 2,
    fuseIndexRecords: index.count,
  };

  eventBus.emitSafe("medicine.side_effects.enrichment.completed", summary);
  return { ...summary, failed };
};

module.exports = {
  buildMedicineMatchIndex: buildMedicineMatcherIndex,
  buildSideEffectEntry,
  candidateTermsForRecord,
  enrichSideEffectsFromFile,
  matchMedicineRecords: matchMedicine,
  readSideEffectsSource,
};
