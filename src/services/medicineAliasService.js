const aliases = require("../../data/medicineAliases.json");
const { normalizeQuery } = require("./intentEngine");

const aliasRows = aliases.flatMap((entry) => {
  const terms = [entry.salt, entry.company, ...(entry.brands || []), ...(entry.commonSpellings || [])];
  return terms.filter(Boolean).map((term) => ({
    term: normalizeQuery(term),
    entry,
  }));
});

const findMedicineAlias = (query) => {
  const normalized = normalizeQuery(query);
  if (!normalized) return null;

  const exact = aliasRows.find((row) => normalized === row.term || normalized.includes(row.term));
  if (exact) return exact.entry;

  return aliasRows.find((row) => row.term.includes(normalized))?.entry || null;
};

const expandMedicineQuery = (query) => {
  const match = findMedicineAlias(query);
  if (!match) {
    return {
      normalizedQuery: query,
      searchTerms: [query],
      categories: [],
      alias: null,
    };
  }

  return {
    normalizedQuery: match.salt,
    searchTerms: [match.salt, ...(match.brands || []), ...(match.commonSpellings || [])],
    categories: match.category ? [match.category] : [],
    alias: match,
  };
};

module.exports = {
  expandMedicineQuery,
  findMedicineAlias,
};
