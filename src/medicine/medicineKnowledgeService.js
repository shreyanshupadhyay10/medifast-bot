const eventBus = require("../events/eventBus");
const MedicineKnowledge = require("../models/MedicineKnowledge");
const { normalizeMedicineQuery } = require("./medicineNormalizer");
const { findRelatedMedicines, buildRelationships } = require("./medicineRelationshipService");

const LOW_CONFIDENCE_THRESHOLD = Number(process.env.MEDICINE_KNOWLEDGE_CONFIDENCE_THRESHOLD || 0.55);

const searchMedicineKnowledge = async ({ query, records = null }) => {
  const normalized = await normalizeMedicineQuery(query, { records });

  if (normalized.confidence < LOW_CONFIDENCE_THRESHOLD || normalized.type === "unknown") {
    eventBus.emitSafe("medicine.knowledge.unknown", {
      query,
      confidence: normalized.confidence,
      reason: normalized.reason,
    });
    return {
      medicine: null,
      alternatives: [],
      relationships: [],
      confidence: normalized.confidence,
      message: "I could not confidently identify this medicine.",
    };
  }

  const medicine =
    normalized.medicine?._id
      ? normalized.medicine
      : records
        ? null
        : await MedicineKnowledge.findOne({
          $or: [
            { genericName: { $regex: `^${normalized.normalizedQuery}$`, $options: "i" } },
            { medicineName: { $regex: `^${normalized.normalizedQuery}$`, $options: "i" } },
            { brands: { $regex: normalized.normalizedQuery, $options: "i" } },
          ],
        }).lean();

  const alternatives = medicine ? await findRelatedMedicines(medicine) : [];
  const relationships = buildRelationships(medicine || normalized.medicine || {});

  eventBus.emitSafe("medicine.knowledge.normalized", {
    query,
    normalizedQuery: normalized.normalizedQuery,
    confidence: normalized.confidence,
    type: normalized.type,
    brandToGeneric: normalized.reason === "curated alias" || Boolean(medicine?.brands?.length),
    relationshipCount: relationships.length,
  });

  return {
    medicine: medicine || normalized.medicine,
    alternatives,
    relationships,
    confidence: normalized.confidence,
    message: null,
  };
};

module.exports = {
  searchMedicineKnowledge,
};
