const { normalizeQuery } = require("../../services/intentEngine");

const normalizeIdentity = (value = "") =>
  normalizeQuery(
    String(value || "")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\b(oral|topical|injection|tablet|capsule|syrup|suspension|cream|gel|drops?)\b/gi, " ")
  );

const diceSimilarity = (left = "", right = "") => {
  const a = normalizeIdentity(left);
  const b = normalizeIdentity(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const grams = (value) => {
    const output = new Map();
    for (let index = 0; index < value.length - 1; index += 1) {
      const gram = value.slice(index, index + 2);
      output.set(gram, (output.get(gram) || 0) + 1);
    }
    return output;
  };

  const aGrams = grams(a);
  const bGrams = grams(b);
  let overlap = 0;
  aGrams.forEach((count, gram) => {
    overlap += Math.min(count, bGrams.get(gram) || 0);
  });

  return (2 * overlap) / (Array.from(aGrams.values()).reduce((sum, count) => sum + count, 0) + Array.from(bGrams.values()).reduce((sum, count) => sum + count, 0));
};

const tokenOverlap = (left = "", right = "") => {
  const aTokens = new Set(normalizeIdentity(left).split(" ").filter(Boolean));
  const bTokens = new Set(normalizeIdentity(right).split(" ").filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;
  const overlap = Array.from(aTokens).filter((token) => bTokens.has(token)).length;
  return overlap / Math.max(aTokens.size, bTokens.size);
};

const weightedConfidence = ({ method, similarity = 1, overlap = 0 }) => {
  const base = {
    genericName: 0.99,
    salts: 0.97,
    brands: 0.93,
    aliases: 0.9,
    commonSpellings: 0.88,
    synonym: 0.94,
    fuzzy: 0.5 + similarity * 0.36 + overlap * 0.08,
    semantic: 0.48 + similarity * 0.45,
  }[method] ?? 0;

  return Number(Math.max(0, Math.min(1, base)).toFixed(3));
};

module.exports = {
  diceSimilarity,
  normalizeIdentity,
  tokenOverlap,
  weightedConfidence,
};
