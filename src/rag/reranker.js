const STOPWORDS = new Set(["a", "an", "and", "are", "for", "from", "hai", "is", "ka", "ke", "ki", "ko", "me", "of", "the", "to"]);

const tokenize = (text = "") =>
  new Set(
    String(text)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token && !STOPWORDS.has(token))
  );

const overlapScore = (query, text) => {
  const queryTokens = tokenize(query);
  if (queryTokens.size === 0) return 0;
  const textTokens = tokenize(text);
  const matches = [...queryTokens].filter((token) => textTokens.has(token)).length;
  return matches / queryTokens.size;
};

const normalizeVectorScore = (score) => {
  if (typeof score !== "number") return 0.5;
  return Math.max(0, Math.min(1, 1 - score));
};

const rerank = (query, results = [], options = {}) => {
  const {
    category,
    semanticWeight = Number(process.env.RETRIEVAL_SEMANTIC_WEIGHT || 0.55),
    keywordWeight = Number(process.env.RETRIEVAL_KEYWORD_WEIGHT || 0.35),
    categoryWeight = Number(process.env.RETRIEVAL_CATEGORY_WEIGHT || 0.1),
  } = options;

  return results
    .map((result) => {
      const semantic = normalizeVectorScore(result.vectorScore ?? result.score);
      const keyword = result.keywordScore ?? overlapScore(query, result.text);
      const categoryMatch = category && result.metadata?.category === category ? 1 : 0;
      const confidence = Math.max(
        0,
        Math.min(1, semantic * semanticWeight + keyword * keywordWeight + categoryMatch * categoryWeight)
      );
      return {
        ...result,
        score: confidence,
        confidence,
        components: {
          semantic,
          keyword,
          category: categoryMatch,
        },
      };
    })
    .sort((a, b) => b.confidence - a.confidence);
};

module.exports = {
  overlapScore,
  rerank,
};
