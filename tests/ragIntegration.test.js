const test = require("node:test");
const assert = require("node:assert/strict");
const { collectKnowledgeFiles, loadKnowledgeBase } = require("../src/rag/documentLoader");
const { chunkDocuments } = require("../src/rag/chunker");
const { keywordRetrieve } = require("../src/rag/hybridRetriever");

test("RAG knowledge files load, chunk, and keyword retrieve context", async () => {
  const files = collectKnowledgeFiles();
  assert.equal(files.some((file) => /fever\.md$/.test(file)), true);

  const documents = await loadKnowledgeBase();
  const chunks = await chunkDocuments(documents);
  const results = await keywordRetrieve("fever paracetamol safety", { k: 3 });

  assert.equal(documents.length >= 2, true);
  assert.equal(chunks.length >= 2, true);
  assert.equal(results.length > 0, true);
  assert.equal(results[0].metadata.category, "symptoms");
});
