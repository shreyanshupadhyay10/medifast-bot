const MedicineKnowledge = require("../models/MedicineKnowledge");
const { normalizeQuery } = require("../services/intentEngine");

const buildRelationships = (medicine = {}) => {
  const generic = medicine.genericName || medicine.medicineName;
  const relationships = [];

  (medicine.brands || []).forEach((brand) => {
    relationships.push({ type: "brand_generic", from: brand, to: generic });
    relationships.push({ type: "generic_brand", from: generic, to: brand });
  });

  (medicine.aliases || []).forEach((alias) => {
    relationships.push({ type: "alias_generic", from: alias, to: generic });
  });

  (medicine.alternatives || []).forEach((alternative) => {
    relationships.push({ type: "medicine_alternative", from: generic, to: alternative });
    relationships.push({ type: "medicine_alternative", from: alternative, to: generic });
  });

  (medicine.symptoms || []).forEach((symptom) => {
    relationships.push({ type: "medicine_symptom", from: generic, to: symptom });
    relationships.push({ type: "symptom_medicine", from: symptom, to: generic });
    relationships.push({ type: "medicine_disease", from: generic, to: symptom });
    relationships.push({ type: "disease_medicine", from: symptom, to: generic });
  });

  (medicine.diseases || []).forEach((disease) => {
    relationships.push({ type: "medicine_disease", from: generic, to: disease });
    relationships.push({ type: "disease_medicine", from: disease, to: generic });
  });

  (medicine.sideEffects || []).forEach((sideEffect) => {
    const effect = typeof sideEffect === "string" ? sideEffect : sideEffect.effect;
    if (!effect) return;
    relationships.push({ type: "medicine_side_effect", from: generic, to: effect });
    relationships.push({ type: "side_effect_medicine", from: effect, to: generic });
  });

  if (medicine.category) {
    relationships.push({ type: "medicine_category", from: generic, to: medicine.category });
    relationships.push({ type: "category_medicine", from: medicine.category, to: generic });
  }

  if (medicine.company) {
    relationships.push({ type: "medicine_manufacturer", from: generic, to: medicine.company });
    relationships.push({ type: "manufacturer_medicine", from: medicine.company, to: generic });
  }

  (medicine.refillPatterns || []).forEach((pattern) => {
    relationships.push({ type: "medicine_refill_pattern", from: generic, to: pattern });
    relationships.push({ type: "refill_pattern_medicine", from: pattern, to: generic });
  });

  return relationships;
};

const buildRefillRelationships = ({ medicineName, entity, pattern = "repeat_search" } = {}) => {
  if (!medicineName) return [];
  const relationships = [
    { type: "medicine_refill_pattern", from: medicineName, to: pattern },
    { type: "refill_pattern_medicine", from: pattern, to: medicineName },
  ];
  if (entity) {
    relationships.push({ type: "family_refill_pattern", from: entity, to: medicineName });
    relationships.push({ type: "medicine_family_refill", from: medicineName, to: entity });
  }
  return relationships;
};

const findRelatedMedicines = async (medicine, { limit = 5 } = {}) => {
  if (!medicine) return [];
  const category = medicine.category;
  const salts = medicine.salts || [];
  const generic = normalizeQuery(medicine.genericName || medicine.medicineName);

  return MedicineKnowledge.find({
    _id: { $ne: medicine._id },
    $or: [
      category ? { category } : null,
      salts.length ? { salts: { $in: salts } } : null,
      { genericName: { $regex: generic, $options: "i" } },
    ].filter(Boolean),
  })
    .limit(limit)
    .lean();
};

module.exports = {
  buildRelationships,
  buildRefillRelationships,
  findRelatedMedicines,
};
