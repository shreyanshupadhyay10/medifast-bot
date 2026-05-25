const fs = require("fs");
const path = require("path");
const Fuse = require("fuse.js");
const { createEmbeddingProvider } = require("../../rag/embeddingProvider");
const {
  diceSimilarity,
  normalizeIdentity,
  tokenOverlap,
  weightedConfidence,
} = require("./confidenceScorer");

const SYNONYM_PATH = path.join(__dirname, "..", "..", "..", "data", "medicineSynonyms.json");

let synonymsCache = null;

const loadMedicineSynonyms = () => {
  if (synonymsCache) return synonymsCache;
  if (!fs.existsSync(SYNONYM_PATH)) {
    synonymsCache = new Map();
    return synonymsCache;
  }

  const raw = JSON.parse(fs.readFileSync(SYNONYM_PATH, "utf8"));
  synonymsCache = new Map(
    Object.entries(raw).map(([alias, canonical]) => [
      normalizeIdentity(alias),
      normalizeIdentity(canonical),
    ])
  );
  return synonymsCache;
};

const compactIdentity = (value = "") => normalizeIdentity(value).replace(/\s+/g, "");
const uniqueTerms = (terms = []) =>
  Array.from(
    new Set(
      terms
        .flatMap((term) => {
          const normalized = normalizeIdentity(term);
          const compact = compactIdentity(term);
          return compact && compact !== normalized ? [normalized, compact] : [normalized];
        })
        .filter(Boolean)
    )
  );

const tokensFor = (value = "") =>
  normalizeIdentity(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

const fieldTerms = (medicine = {}) => ({
  genericName: uniqueTerms([medicine.genericName]),
  salts: uniqueTerms(medicine.salts || []),
  brands: uniqueTerms([medicine.medicineName, ...(medicine.brands || [])]),
  aliases: uniqueTerms(medicine.aliases || []),
  commonSpellings: uniqueTerms(medicine.commonSpellings || []),
});

const addToIndex = (map, key, medicine) => {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(medicine);
};

const addSearchTermToCandidateIndexes = ({ tokenIndex, prefixIndex, term, medicine }) => {
  tokensFor(term).forEach((token) => {
    addToIndex(tokenIndex, token, medicine);
    addToIndex(prefixIndex, token.slice(0, 4), medicine);
  });
};

const medicineSearchText = (medicine = {}) =>
  uniqueTerms([
    medicine.medicineName,
    medicine.genericName,
    ...(medicine.salts || []),
    ...(medicine.brands || []),
    ...(medicine.aliases || []),
    ...(medicine.commonSpellings || []),
  ]).join(" ");

const buildMedicineMatcherIndex = (medicines = []) => {
  const fields = {
    genericName: new Map(),
    salts: new Map(),
    brands: new Map(),
    aliases: new Map(),
    commonSpellings: new Map(),
  };

  medicines.forEach((medicine) => {
    const terms = fieldTerms(medicine);
    Object.entries(terms).forEach(([field, values]) => {
      values.forEach((value) => addToIndex(fields[field], value, medicine));
    });
  });

  const searchable = medicines.map((medicine) => ({
    ...medicine,
    _matcherSearchText: medicineSearchText(medicine),
  }));
  const tokenIndex = new Map();
  const prefixIndex = new Map();
  searchable.forEach((medicine) => {
    addSearchTermToCandidateIndexes({
      tokenIndex,
      prefixIndex,
      term: medicine._matcherSearchText,
      medicine,
    });
  });

  return {
    fields,
    medicines: searchable,
    tokenIndex,
    prefixIndex,
  };
};

const candidateTermsForRecord = (record = {}) => ({
  genericName: uniqueTerms([record.genericName]),
  medicineName: uniqueTerms([record.medicineName]),
  brands: uniqueTerms(record.brands || []),
});

const rawQueryForRecord = (record = {}) =>
  [record.genericName, record.medicineName, ...(record.brands || [])]
    .map(normalizeIdentity)
    .filter(Boolean)
    .join(" ");

const expandWithSynonyms = (terms = [], synonyms = loadMedicineSynonyms()) => {
  const expanded = new Set(terms);
  terms.forEach((term) => {
    const canonical = synonyms.get(term);
    if (canonical) expanded.add(canonical);
  });
  return Array.from(expanded);
};

const pushMatches = ({ output, medicines, method, query, confidence }) => {
  medicines.forEach((medicine) => {
    const key = String(medicine._id || medicine.knowledgeKey || medicine.medicineName);
    const previous = output.get(key);
    const candidate = {
      medicine,
      confidence,
      method,
      query,
      reason: `${method} match`,
    };
    if (!previous || candidate.confidence > previous.confidence) output.set(key, candidate);
  });
};

const exactPriorityMatch = (record, index, synonyms = loadMedicineSynonyms()) => {
  const terms = candidateTermsForRecord(record);
  const matches = new Map();

  const priority = [
    { input: terms.genericName, field: "genericName", method: "genericName" },
    { input: terms.genericName, field: "salts", method: "salts" },
    { input: terms.medicineName, field: "brands", method: "brands" },
    { input: terms.brands, field: "brands", method: "brands" },
    { input: [...terms.genericName, ...terms.medicineName, ...terms.brands], field: "aliases", method: "aliases" },
    { input: [...terms.genericName, ...terms.medicineName, ...terms.brands], field: "commonSpellings", method: "commonSpellings" },
  ];

  for (const step of priority) {
    const searchTerms = expandWithSynonyms(step.input, synonyms);
    searchTerms.forEach((term) => {
      pushMatches({
        output: matches,
        medicines: index.fields[step.field].get(term) || [],
        method: step.method,
        query: term,
        confidence: weightedConfidence({ method: step.method }),
      });
    });
    if (matches.size) break;
  }

  if (!matches.size) {
    const allTerms = [...terms.genericName, ...terms.medicineName, ...terms.brands];
    expandWithSynonyms(allTerms, synonyms)
      .filter((term) => !allTerms.includes(term))
      .forEach((term) => {
        ["genericName", "salts", "brands", "aliases", "commonSpellings"].forEach((field) => {
          pushMatches({
            output: matches,
            medicines: index.fields[field].get(term) || [],
            method: "synonym",
            query: term,
            confidence: weightedConfidence({ method: "synonym" }),
          });
        });
      });
  }

  return matches;
};

const fuzzyMatch = (record, index, { candidateLimit = Number(process.env.MEDICINE_MATCHER_FUZZY_CANDIDATE_LIMIT || 500) } = {}) => {
  const query = rawQueryForRecord(record);
  if (!query) return new Map();

  const candidateMap = new Map();
  tokensFor(query).forEach((token) => {
    [
      ...(index.tokenIndex.get(token) || []),
      ...(index.prefixIndex.get(token.slice(0, 4)) || []),
    ].forEach((medicine) => {
      candidateMap.set(String(medicine._id || medicine.knowledgeKey || medicine.medicineName), medicine);
    });
  });

  const candidates = Array.from(candidateMap.values()).slice(0, candidateLimit);
  if (!candidates.length) return new Map();

  const fuse = new Fuse(candidates, {
    keys: ["_matcherSearchText"],
    includeScore: true,
    threshold: 0.28,
    ignoreLocation: true,
    minMatchCharLength: 3,
  });

  const matches = new Map();
  fuse.search(query, { limit: 8 }).forEach((result) => {
    const similarity = 1 - (result.score || 0);
    const overlap = Math.max(tokenOverlap(query, result.item._matcherSearchText), diceSimilarity(query, result.item._matcherSearchText) * 0.5);
    const confidence = weightedConfidence({ method: "fuzzy", similarity, overlap });
    if (confidence < 0.5) return;
    pushMatches({
      output: matches,
      medicines: [result.item],
      method: "fuzzy",
      query,
      confidence,
    });
  });
  return matches;
};

const cosineSimilarity = (left = [], right = []) => {
  if (!left.length || !right.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftMag = 0;
  let rightMag = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMag += left[index] ** 2;
    rightMag += right[index] ** 2;
  }
  if (!leftMag || !rightMag) return 0;
  return dot / (Math.sqrt(leftMag) * Math.sqrt(rightMag));
};

const semanticMatch = async (record, index, { limit = 8, embeddingProvider = createEmbeddingProvider() } = {}) => {
  const query = rawQueryForRecord(record);
  if (!query || !index.medicines.length) return new Map();

  const queryVector = await embeddingProvider.embedQuery(query);
  const candidates = [];
  const pool = fuzzyMatch(record, index, { candidateLimit: limit * 10 });
  const medicines = pool.size ? Array.from(pool.values()).map((item) => item.medicine) : index.medicines.slice(0, limit);

  for (const medicine of medicines.slice(0, limit)) {
    const text = medicine._matcherSearchText || medicineSearchText(medicine);
    const vector = await embeddingProvider.embedQuery(text);
    const similarity = cosineSimilarity(queryVector, vector);
    candidates.push({
      medicine,
      confidence: weightedConfidence({ method: "semantic", similarity }),
      similarity,
    });
  }

  const matches = new Map();
  candidates
    .filter((candidate) => candidate.confidence >= 0.5)
    .sort((a, b) => b.confidence - a.confidence)
    .forEach((candidate) => {
      pushMatches({
        output: matches,
        medicines: [candidate.medicine],
        method: "semantic",
        query,
        confidence: candidate.confidence,
      });
    });

  return matches;
};

const mergeMatchMaps = (...maps) => {
  const merged = new Map();
  maps.forEach((map) => {
    map.forEach((match, key) => {
      const previous = merged.get(key);
      if (!previous || match.confidence > previous.confidence) merged.set(key, match);
    });
  });
  return merged;
};

const matchMedicine = async (record = {}, index, options = {}) => {
  const exact = exactPriorityMatch(record, index);
  let merged = exact;
  let usedSemantic = false;

  if (!merged.size && options.useFuzzy !== false) {
    merged = fuzzyMatch(record, index, options);
  }

  if ((!merged.size || Math.max(...Array.from(merged.values()).map((item) => item.confidence)) < 0.8) && options.useSemantic) {
    try {
      const semantic = await semanticMatch(record, index, options);
      usedSemantic = semantic.size > 0;
      merged = mergeMatchMaps(merged, semantic);
    } catch {
      // Semantic matching is optional; deterministic matching remains the fallback.
    }
  }

  const matches = Array.from(merged.values()).sort((a, b) => b.confidence - a.confidence);
  const bestConfidence = matches[0]?.confidence || 0;
  return {
    confidence: bestConfidence,
    reason: matches[0]?.reason || "no medicine match",
    method: matches[0]?.method || "none",
    usedSemantic,
    medicines: matches.map((match) => match.medicine),
    matches,
  };
};

module.exports = {
  buildMedicineMatcherIndex,
  candidateTermsForRecord,
  compactIdentity,
  cosineSimilarity,
  exactPriorityMatch,
  expandWithSynonyms,
  fuzzyMatch,
  loadMedicineSynonyms,
  matchMedicine,
  semanticMatch,
  uniqueTerms,
};
