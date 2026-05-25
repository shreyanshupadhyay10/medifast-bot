const eventBus = require("../events/eventBus");
const MedicineKnowledge = require("../models/MedicineKnowledge");
const { normalizeMedicineQuery } = require("./medicineNormalizer");
const { findRelatedMedicines, buildRelationships } = require("./medicineRelationshipService");

const LOW_CONFIDENCE_THRESHOLD = Number(process.env.MEDICINE_KNOWLEDGE_CONFIDENCE_THRESHOLD || 0.55);

const searchMedicineKnowledge = async ({ query, records = null }) => {
  const normalized = await normalizeMedicineQuery(query, { records });

  if (normalized.type === "category" && !records) {
    const categoryMedicine = await MedicineKnowledge.findOne({
      category: { $regex: `^${normalized.normalizedQuery}$`, $options: "i" },
    })
      .sort({ confidence: -1, updatedAt: -1 })
      .lean();
    if (categoryMedicine) {
      const relationships = buildRelationships(categoryMedicine);
      eventBus.emitSafe("medicine.knowledge.normalized", {
        query,
        normalizedQuery: normalized.normalizedQuery,
        confidence: normalized.confidence,
        type: "category",
        reason: normalized.reason,
        relationshipCount: relationships.length,
      });
      return {
        medicine: categoryMedicine,
        alternatives: await findRelatedMedicines(categoryMedicine),
        relationships,
        confidence: normalized.confidence,
        suggestions: [],
        message: null,
      };
    }
  }

  if (normalized.confidence < LOW_CONFIDENCE_THRESHOLD || normalized.type === "unknown") {
    eventBus.emitSafe("medicine.knowledge.unknown", {
      query,
      confidence: normalized.confidence,
      reason: normalized.reason,
      method: normalized.method,
      usedSemantic: normalized.usedSemantic,
      suggestions: normalized.suggestions || [],
    });
    return {
      medicine: null,
      alternatives: [],
      relationships: [],
      confidence: normalized.confidence,
      suggestions: normalized.suggestions || [],
      message: "I could not confidently identify this medicine.",
    };
  }

  const medicine =
    normalized.medicine?._id || normalized.reason === "curated alias"
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

  const alternatives = medicine?._id ? await findRelatedMedicines(medicine) : [];
  const relationships = buildRelationships(medicine || normalized.medicine || {});

  eventBus.emitSafe("medicine.knowledge.normalized", {
    query,
    normalizedQuery: normalized.normalizedQuery,
    confidence: normalized.confidence,
    type: normalized.type,
    method: normalized.method,
    reason: normalized.reason,
    usedSemantic: normalized.usedSemantic,
    brandToGeneric: normalized.reason === "curated alias" || Boolean(medicine?.brands?.length),
    relationshipCount: relationships.length,
  });

  return {
    medicine: medicine || normalized.medicine,
    alternatives,
    relationships,
    confidence: normalized.confidence,
    suggestions: normalized.suggestions || [],
    message: null,
  };
};

module.exports = {
  searchMedicineKnowledge,
};
