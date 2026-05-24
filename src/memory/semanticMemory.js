const { DEFAULT_MEMORY_COLLECTION, retrieve, upsertChunks, stableId } = require("../rag/retriever");

const factToText = (fact) => `${fact.entity || "self"} ${fact.type || "fact"} ${fact.value || ""}`.trim();

const saveFactsToSemanticMemory = async ({ telegramId, facts = [] }) => {
  const importantFacts = facts.filter((fact) => fact.entity && fact.value);
  if (!telegramId || importantFacts.length === 0) return [];

  const chunks = importantFacts.map((fact, index) => {
    const text = factToText(fact);
    return {
      id: stableId("memory", `${telegramId}:${text}:${index}`),
      text,
      metadata: {
        telegramId: String(telegramId),
        type: fact.type || "fact",
        entity: fact.entity,
        value: fact.value,
        trust: "user_memory",
        source: fact.source || "conversation",
        updatedAt: new Date().toISOString(),
      },
    };
  });

  await upsertChunks(chunks, { collectionName: DEFAULT_MEMORY_COLLECTION });
  return chunks.map((chunk) => chunk.id);
};

const retrieveRelevantMemory = async ({ telegramId, query, k = 4 }) => {
  const results = await retrieve(query, {
    collectionName: DEFAULT_MEMORY_COLLECTION,
    k,
    metadata: telegramId ? { telegramId: String(telegramId) } : {},
  });

  return {
    facts: results.map((result) => ({
      type: result.metadata.type,
      entity: result.metadata.entity,
      value: result.metadata.value,
      source: result.metadata.source,
      score: result.score,
      confidence: result.confidence || Math.max(0, Math.min(1, 1 - (result.score || 0))),
    })),
    raw: results,
  };
};

module.exports = {
  retrieveRelevantMemory,
  saveFactsToSemanticMemory,
};
