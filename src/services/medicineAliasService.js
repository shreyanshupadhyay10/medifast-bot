const { normalizeQuery } = require("./intentEngine");

const ALIAS_GROUPS = [
  ["modafinil", "modalert", "modalert 200", "moda alert"],
  ["ivermectin", "ivak", "ivect", "ivermectol"],
  ["paracetamol", "dolo", "calpol", "crocin"],
  ["pantoprazole", "pantocid", "pan 40", "pantop"],
  ["cetirizine", "cetzine", "okacet", "alerid"],
];

const aliasIndex = new Map();
for (const group of ALIAS_GROUPS) {
  for (const term of group) {
    aliasIndex.set(normalizeQuery(term), group);
  }
}

const expandMedicineAliases = (query) => {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];

  const direct = aliasIndex.get(normalized);
  if (direct) return [...new Set(direct.filter((v) => normalizeQuery(v) !== normalized))];

  for (const [alias, group] of aliasIndex.entries()) {
    if (normalized.includes(alias)) {
      return [...new Set(group.filter((v) => normalizeQuery(v) !== alias))];
    }
  }

  return [];
};

module.exports = {
  expandMedicineAliases,
};
