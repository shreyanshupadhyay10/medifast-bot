const Inventory = require("../models/Inventory");
const { normalizeQuery } = require("../services/intentEngine");

const termsForMedicine = ({ medicineQuery, medicineKnowledge } = {}) =>
  Array.from(
    new Set(
      [
        medicineQuery,
        medicineKnowledge?.medicineName,
        medicineKnowledge?.genericName,
        ...(medicineKnowledge?.salts || []),
        ...(medicineKnowledge?.brands || []),
        ...(medicineKnowledge?.aliases || []),
        ...(medicineKnowledge?.commonSpellings || []),
      ]
        .map((term) => String(term || "").trim())
        .filter(Boolean)
    )
  );

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildInventoryMatcher = (terms = []) => {
  const normalizedTerms = terms.map(normalizeQuery).filter(Boolean);
  return (value) => {
    const normalized = normalizeQuery(value);
    return normalizedTerms.some((term) => normalized.includes(term) || term.includes(normalized));
  };
};

const COMMON_CATEGORY_CONFIDENCE = {
  painkiller: 0.5,
  gastro: 0.48,
  respiratory: 0.45,
  vitamins: 0.42,
  dermatology: 0.38,
  antidiabetic: 0.34,
  cardiac: 0.32,
  neurological: 0.28,
  antibiotic: 0.24,
};

const findInventoryMatches = async ({ pharmacyIds = [], medicineQuery, medicineKnowledge } = {}) => {
  if (!pharmacyIds.length || !medicineQuery) return new Map();

  const terms = termsForMedicine({ medicineQuery, medicineKnowledge });
  const regexes = terms.slice(0, 10).map((term) => new RegExp(escapeRegex(term), "i"));
  const inventory = await Inventory.find({
    pharmacy: { $in: pharmacyIds },
    inStock: true,
    $or: [
      { medicineName: { $in: regexes } },
      { genericName: { $in: regexes } },
      { brand: { $in: regexes } },
    ],
  }).lean();

  const byPharmacy = new Map();
  inventory.forEach((item) => {
    const key = String(item.pharmacy);
    if (!byPharmacy.has(key)) byPharmacy.set(key, []);
    byPharmacy.get(key).push(item);
  });

  return byPharmacy;
};

const scoreInventoryMatch = ({ pharmacy, matches = [], medicineQuery, medicineKnowledge, historicalDemand = 0 } = {}) => {
  const inventoryNames = [
    ...(pharmacy.inventory || []),
    ...matches.flatMap((item) => [item.medicineName, item.genericName, item.brand]),
  ].filter(Boolean);
  if (!medicineQuery && !medicineKnowledge) return 0.4;
  const terms = termsForMedicine({ medicineQuery, medicineKnowledge });
  const hasRelationshipData =
    Boolean(medicineKnowledge?.genericName) ||
    Boolean(medicineKnowledge?.category) ||
    terms.length > 1;
  if (!inventoryNames.length && !matches.length) {
    if (!hasRelationshipData || !pharmacy?.source) return 0;
    const categoryBase = COMMON_CATEGORY_CONFIDENCE[normalizeQuery(medicineKnowledge?.category)] || 0.22;
    const aliasBoost = terms.length > 2 ? 0.08 : 0;
    const sourceBoost = pharmacy.source === "OpenStreetMap" ? 0.06 : 0.03;
    const demandBoost = Math.min(Number(historicalDemand || 0) * 0.03, 0.12);
    return Math.min(0.82, categoryBase + aliasBoost + sourceBoost + demandBoost);
  }

  const matcher = buildInventoryMatcher(terms);
  if (inventoryNames.some(matcher)) return 1;
  if (matches.length) return 0.85;
  return 0.2;
};

module.exports = {
  buildInventoryMatcher,
  findInventoryMatches,
  scoreInventoryMatch,
  termsForMedicine,
};
