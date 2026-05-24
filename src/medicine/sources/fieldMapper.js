const { normalizeQuery } = require("../../services/intentEngine");

const FIELD_CANDIDATES = {
  medicineName: ["medicine name", "medicine_name", "name", "product name", "drug name", "item name"],
  genericName: ["generic name", "generic_name", "generic", "active ingredient"],
  salt: ["salt", "salts", "composition", "short composition", "short_composition", "short_composition1", "short_composition2"],
  brand: ["brand", "brand name", "brand_name"],
  company: ["company", "manufacturer", "manufacturer name", "manufacturer_name", "maker"],
  category: ["category", "class", "therapy", "type"],
  symptoms: ["symptoms", "uses", "indications", "use case"],
  sideEffects: ["side effects", "side_effects", "adverse effects"],
  alternatives: ["alternatives", "substitutes", "substitute", "similar medicines"],
  aliases: ["aliases", "alias", "common names", "common_name"],
  prescriptionRequired: ["prescription required", "rx required", "rx", "prescription_required"],
  commonSpellings: ["common spellings", "spellings", "misspellings"],
};

const normalizeHeader = (header = "") => normalizeQuery(String(header).replace(/[₹()]/g, " "));

const scoreHeader = (header, candidates) => {
  const normalized = normalizeHeader(header);
  return candidates.reduce((score, candidate) => {
    const candidateNorm = normalizeHeader(candidate);
    if (normalized === candidateNorm) return Math.max(score, 1);
    if (
      normalized.length >= 5 &&
      candidateNorm.length >= 5 &&
      (normalized.includes(candidateNorm) || candidateNorm.includes(normalized))
    ) {
      return Math.max(score, 0.72);
    }
    return score;
  }, 0);
};

const detectFieldMap = (headers = []) => {
  const map = {};

  Object.entries(FIELD_CANDIDATES).forEach(([field, candidates]) => {
    const scored = headers
      .map((header) => ({ header, score: scoreHeader(header, candidates) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (field === "salt") {
      map[field] = scored.map((item) => item.header);
    } else if (scored[0]) {
      map[field] = scored[0].header;
    }
  });

  return map;
};

const emptyToNull = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || ["na", "n/a", "null", "undefined", "-"].includes(trimmed.toLowerCase())) return null;
  return trimmed;
};

const extractCompositionName = (value) => {
  const clean = emptyToNull(value);
  if (!clean) return null;
  return clean
    .replace(/\([^)]*\)/g, "")
    .replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|%)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

const mapRecordFields = (rawRecord = {}, fieldMap = detectFieldMap(Object.keys(rawRecord))) => {
  const get = (field) => {
    const source = fieldMap[field];
    if (!source) return null;
    return emptyToNull(rawRecord[source]);
  };

  const saltSources = Array.isArray(fieldMap.salt) ? fieldMap.salt : [fieldMap.salt].filter(Boolean);
  const salts = saltSources.map((source) => extractCompositionName(rawRecord[source])).filter(Boolean);
  const medicineName = get("medicineName");
  const genericName = get("genericName") || salts.join(" + ") || medicineName;
  const brand = get("brand") || medicineName;
  const sourceKind = medicineName && salts.length && !fieldMap.genericName ? "product_catalog" : "curated";

  return {
    medicineName,
    genericName,
    salts,
    brands: brand ? [brand] : [],
    aliases: get("aliases"),
    company: get("company"),
    category: get("category"),
    symptoms: get("symptoms"),
    sideEffects: get("sideEffects"),
    alternatives: get("alternatives"),
    prescriptionRequired: get("prescriptionRequired"),
    commonSpellings: get("commonSpellings"),
    sourceKind,
  };
};

module.exports = {
  detectFieldMap,
  emptyToNull,
  extractCompositionName,
  mapRecordFields,
};
