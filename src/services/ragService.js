const fs = require("fs");
const path = require("path");
const { createProvider } = require("../providers");
const { hybridRetrieve } = require("../rag/hybridRetriever");
const { evaluateRetrieval, recordRetrievalMetric } = require("../rag/evaluator");
const { retrieveRelevantMemory } = require("../memory/semanticMemory");

const KNOWLEDGE_ROOT = path.join(__dirname, "..", "..", "knowledge-base");

const listKnowledgeSources = () => {
  if (!fs.existsSync(KNOWLEDGE_ROOT)) return [];
  return fs.readdirSync(KNOWLEDGE_ROOT, { withFileTypes: true }).flatMap((entry) => {
    const categoryPath = path.join(KNOWLEDGE_ROOT, entry.name);
    if (!entry.isDirectory()) return [];
    return fs
      .readdirSync(categoryPath)
      .filter((file) => /\.(md|txt|csv)$/i.test(file))
      .map((file) => ({
        source: path.join(categoryPath, file),
        category: entry.name,
        trust: "curated",
        updatedAt: null,
      }));
  });
};

const knowledgeFilter = (metadata = {}) =>
  ["source", "category", "trust", "updatedAt"].reduce((filter, key) => {
    if (metadata[key]) filter[key] = metadata[key];
    return filter;
  }, {});

const LOW_CONFIDENCE_THRESHOLD = Number(process.env.RETRIEVAL_CONFIDENCE_THRESHOLD || 0.4);

const retrieveKnowledge = async ({ question, metadata = {}, k = 4 }) => {
  const startedAt = Date.now();
  const context = await hybridRetrieve(question, {
    k,
    metadata: knowledgeFilter(metadata),
    category: metadata.category,
  });
  const metric = evaluateRetrieval(question, context, {
    retrievalType: "hybrid",
    latencyMs: Date.now() - startedAt,
  });
  await recordRetrievalMetric(metric);

  return {
    context,
    sources: context.map((item) => item.metadata),
    confidence: context[0]?.confidence || 0,
    lowConfidence: (context[0]?.confidence || 0) < LOW_CONFIDENCE_THRESHOLD,
  };
};

const answerFromKnowledgeBase = async (query, metadata = {}) => {
  const knowledge = await retrieveKnowledge({ question: query, metadata });
  const memory = metadata.telegramId
    ? await retrieveRelevantMemory({ telegramId: metadata.telegramId, query })
    : { facts: [] };
  const provider = createProvider();
  const generated = await provider.generate({
    prompt: query,
    fallback: knowledge.lowConfidence
      ? "I could not confidently find a trusted knowledge match for this question."
      : "",
    context: knowledge.context,
    memory: memory.facts,
  });

  return {
    answer: generated.text,
    sources: knowledge.sources.length ? knowledge.sources : listKnowledgeSources(),
    memory: memory.facts,
    context: knowledge.context,
    confidence: knowledge.confidence,
    lowConfidence: knowledge.lowConfidence,
    metadata,
    status: "rag-ready",
    query,
  };
};

module.exports = {
  answerFromKnowledgeBase,
  listKnowledgeSources,
  retrieveKnowledge,
};
