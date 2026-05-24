const { normalizeQuery } = require("../../services/intentEngine");

const FIELD_CANDIDATES = {
  medicineName: ["medicine name", "medicine_name", "drug name", "drug_name", "drug", "name"],
  genericName: ["generic name", "generic_name", "generic", "active ingredient"],
  sideEffects: ["side effects", "side_effects", "adverse effects", "adverse_effects", "effects"],
  severity: ["severity", "seriousness", "reaction severity"],
  frequency: ["frequency", "incidence", "commonness", "rate"],
  source: ["source", "source url", "drug link", "drug_link", "url", "link"],
  brand: ["brand", "brand name", "brand_names", "brands"],
};

const normalizeHeader = (header = "") => normalizeQuery(String(header).replace(/[()]/g, " "));

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

const detectSideEffectsFieldMap = (headers = []) => {
  const map = {};
  Object.entries(FIELD_CANDIDATES).forEach(([field, candidates]) => {
    const [best] = headers
      .map((header) => ({ header, score: scoreHeader(header, candidates) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);
    if (best) map[field] = best.header;
  });
  return map;
};

const emptyToNull = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || ["na", "n/a", "null", "undefined", "-"].includes(trimmed.toLowerCase())) return null;
  return trimmed;
};

const splitList = (value) => {
  const clean = emptyToNull(value);
  if (!clean) return [];
  return clean
    .split(/[|,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const mapSideEffectsRecord = (rawRecord = {}, fieldMap = detectSideEffectsFieldMap(Object.keys(rawRecord))) => {
  const get = (field) => {
    const source = fieldMap[field];
    if (!source) return null;
    return emptyToNull(rawRecord[source]);
  };

  return {
    medicineName: get("medicineName"),
    genericName: get("genericName"),
    brands: splitList(get("brand")),
    sideEffects: get("sideEffects"),
    severity: get("severity"),
    frequency: get("frequency"),
    source: get("source"),
  };
};

const validateSideEffectsRecord = (record = {}) => {
  const errors = [];
  if (!record.sideEffects) errors.push("Missing side effects text.");
  if (!record.medicineName && !record.genericName && !(record.brands || []).length) {
    errors.push("Missing medicine identity.");
  }
  return {
    valid: errors.length === 0,
    errors,
  };
};

module.exports = {
  detectSideEffectsFieldMap,
  emptyToNull,
  mapSideEffectsRecord,
  splitList,
  validateSideEffectsRecord,
};
