const { collectKnowledgeFiles, loadKnowledgeBase } = require("./documentLoader");
const { chunkDocuments } = require("./chunker");
const { getCollection, DEFAULT_COLLECTION, getVectorMode, getVectorStoragePath } = require("./retriever");
const { retrieveKnowledge } = require("../services/ragService");
const { getRetrievalQualitySummary } = require("./evaluator");

const countVectors = async (collectionName = DEFAULT_COLLECTION) => {
  try {
    const collection = await getCollection(collectionName);
    return {
      available: true,
      vectorCount: await collection.count(),
      collectionStatus: "ready",
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      vectorCount: 0,
      collectionStatus: "unavailable",
      error: error.message,
    };
  }
};

const diagnoseRag = async ({ query = "fever medicine safety", collectionName = DEFAULT_COLLECTION } = {}) => {
  const startedAt = Date.now();
  const files = collectKnowledgeFiles();
  const documents = await loadKnowledgeBase();
  const chunks = await chunkDocuments(documents);
  const vector = await countVectors(collectionName);
  const retrieval = await retrieveKnowledge({ question: query, k: 4 });
  const quality = await getRetrievalQualitySummary();

  return {
    knowledgeFiles: files.length,
    loadedDocuments: documents.length,
    chunkCount: chunks.length,
    chromaAvailable: vector.available,
    vectorMode: getVectorMode(),
    vectorCount: vector.vectorCount,
    collectionStatus: vector.collectionStatus,
    storagePath: getVectorStoragePath(),
    vectorError: vector.error,
    retrievalHits: retrieval.context.length,
    topConfidence: retrieval.confidence,
    retrievalLowConfidence: retrieval.lowConfidence,
    retrievalLatencyMs: Date.now() - startedAt,
    retrievedSources: retrieval.sources,
    quality,
  };
};

module.exports = {
  diagnoseRag,
};
