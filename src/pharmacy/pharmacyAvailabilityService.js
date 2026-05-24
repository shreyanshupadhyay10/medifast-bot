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

const scoreInventoryMatch = ({ pharmacy, matches = [], medicineQuery, medicineKnowledge } = {}) => {
  const inventoryNames = [
    ...(pharmacy.inventory || []),
    ...matches.flatMap((item) => [item.medicineName, item.genericName, item.brand]),
  ].filter(Boolean);
  if (!medicineQuery && !medicineKnowledge) return 0.4;
  if (!inventoryNames.length && !matches.length) return 0;

  const matcher = buildInventoryMatcher(termsForMedicine({ medicineQuery, medicineKnowledge }));
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
