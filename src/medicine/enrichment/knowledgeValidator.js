const { normalizeQuery } = require("../../services/intentEngine");

const normalizeList = (items = []) =>
  [...new Set((Array.isArray(items) ? items : [items]).flat().map((item) => String(item || "").trim()).filter(Boolean))];

const validateKnowledgeRecord = (record = {}) => {
  const errors = [];
  if (!record.medicineName) errors.push("Missing medicineName.");
  if (!record.genericName) errors.push("Missing genericName.");
  if (!record.knowledgeKey) errors.push("Missing knowledgeKey.");
  if (!normalizeList(record.salts).length && !record.genericName) errors.push("Missing salts/generic identity.");

  return {
    valid: errors.length === 0,
    errors,
  };
};

const buildAutoAliases = (record = {}) => {
  const aliases = normalizeList(record.aliases);
  const brands = normalizeList(record.brands);
  const salts = normalizeList(record.salts);
  const symptoms = normalizeList(record.symptoms);
  const category = normalizeQuery(record.category || "");

  const generated = [
    ...aliases,
    ...brands.map((brand) => `${brand} medicine`),
    ...salts.map((salt) => `${salt} tablet`),
    ...symptoms.map((symptom) => `${symptom} medicine`),
    category && `${category} medicine`,
  ];

  return normalizeList(generated).slice(0, 24);
};

module.exports = {
  buildAutoAliases,
  normalizeList,
  validateKnowledgeRecord,
};
