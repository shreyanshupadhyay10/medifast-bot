const crypto = require("crypto");
const { ChromaClient } = require("chromadb");
const { createEmbeddings } = require("./embeddings");
const { DEFAULT_STORAGE_PATH, getLocalCollection } = require("./localVectorStore");
const eventBus = require("../events/eventBus");
const logger = require("../utils/logger");

const DEFAULT_COLLECTION = process.env.CHROMA_KNOWLEDGE_COLLECTION || "medifast_knowledge";
const DEFAULT_MEMORY_COLLECTION = process.env.CHROMA_MEMORY_COLLECTION || "medifast_memory";
const DEFAULT_LOCAL_PATH = process.env.CHROMA_LOCAL_PATH || DEFAULT_STORAGE_PATH;

const getVectorMode = () => {
  if (process.env.VECTOR_MODE === "local") return "local";
  if (process.env.CHROMA_URL) return "remote";
  return "local";
};

const getVectorStoragePath = () => (getVectorMode() === "local" ? DEFAULT_LOCAL_PATH : null);

const createChromaClient = () =>
  (() => {
    const url = new URL(process.env.CHROMA_URL || "http://localhost:8000");
    return new ChromaClient({
      host: url.hostname,
      port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
      ssl: url.protocol === "https:",
    });
  })();

const getCollection = async (name = DEFAULT_COLLECTION) => {
  if (getVectorMode() === "local") {
    return getLocalCollection({ name, storagePath: getVectorStoragePath() });
  }
  const client = createChromaClient();
  return client.getOrCreateCollection({ name });
};

const stableId = (prefix, value) =>
  `${prefix}_${crypto.createHash("sha1").update(String(value)).digest("hex")}`;

const distanceToConfidence = (distance) => {
  if (typeof distance !== "number") return 0.5;
  return Math.max(0, Math.min(1, 1 - distance));
};

const upsertChunks = async (chunks, { collectionName = DEFAULT_COLLECTION } = {}) => {
  if (!chunks.length) return { count: 0, collectionName };

  const embeddings = createEmbeddings();
  const collection = await getCollection(collectionName);
  const vectors = await embeddings.embedDocuments(chunks.map((chunk) => chunk.text));
  const ids = chunks.map((chunk) => stableId("chunk", chunk.id));

  await collection.upsert({
    ids,
    documents: chunks.map((chunk) => chunk.text),
    embeddings: vectors,
    metadatas: chunks.map((chunk) => chunk.metadata),
  });

  return { count: chunks.length, collectionName, vectorMode: getVectorMode(), storagePath: getVectorStoragePath() };
};

const retrieve = async (query, { collectionName = DEFAULT_COLLECTION, k = 4, metadata = {} } = {}) => {
  try {
    const embeddings = createEmbeddings();
    const collection = await getCollection(collectionName);
    const queryEmbedding = await embeddings.embedQuery(query);
    const response = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: k,
      where: Object.keys(metadata).length ? metadata : undefined,
    });

    const documents = response.documents?.[0] || [];
    const metadatas = response.metadatas?.[0] || [];
    const distances = response.distances?.[0] || [];
    const results = documents.map((text, index) => ({
      text,
      metadata: metadatas[index] || {},
      score: distances[index],
      confidence: distanceToConfidence(distances[index]),
    }));

    eventBus.emitSafe("retrieval.completed", {
      type: collectionName === DEFAULT_MEMORY_COLLECTION ? "memory" : "knowledge",
      query,
      hitCount: results.length,
    });

    return results;
  } catch (error) {
    logger.warn(`Vector retrieval unavailable: ${error.message}`);
    eventBus.emitSafe("retrieval.completed", {
      type: collectionName === DEFAULT_MEMORY_COLLECTION ? "memory" : "knowledge",
      query,
      hitCount: 0,
      error: error.message,
    });
    return [];
  }
};

module.exports = {
  DEFAULT_COLLECTION,
  DEFAULT_MEMORY_COLLECTION,
  DEFAULT_LOCAL_PATH,
  distanceToConfidence,
  getCollection,
  getVectorMode,
  getVectorStoragePath,
  retrieve,
  stableId,
  upsertChunks,
};
