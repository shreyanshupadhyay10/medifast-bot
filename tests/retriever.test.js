const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { distanceToConfidence } = require("../src/rag/retriever");
const { LocalVectorCollection } = require("../src/rag/localVectorStore");
const { mergeResults } = require("../src/rag/hybridRetriever");
const { evaluateRetrieval } = require("../src/rag/evaluator");

test("converts vector distance into bounded confidence", () => {
  assert.equal(distanceToConfidence(0), 1);
  assert.equal(distanceToConfidence(2), 0);
  assert.equal(distanceToConfidence(undefined), 0.5);
});

test("hybrid merge removes duplicates and keeps best keyword score", () => {
  const merged = mergeResults(
    [{ text: "fever guide", metadata: { source: "a.md", chunkIndex: 1 }, vectorScore: 0.2 }],
    [{ text: "fever guide", metadata: { source: "a.md", chunkIndex: 1 }, keywordScore: 0.9 }]
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].keywordScore, 0.9);
});

test("evaluator reports failure and confidence metrics", () => {
  const failed = evaluateRetrieval("unknown", []);
  const passed = evaluateRetrieval("fever", [{ confidence: 0.87, metadata: { category: "symptoms" } }]);

  assert.equal(failed.failed, true);
  assert.equal(passed.topConfidence, 0.87);
  assert.deepEqual(passed.categories, ["symptoms"]);
});

test("local vector collection persists vectors and filters metadata", async () => {
  const storagePath = path.join(__dirname, "..", "data", "test-chroma");
  fs.rmSync(storagePath, { recursive: true, force: true });

  const collection = new LocalVectorCollection({ name: "test_collection", storagePath });
  await collection.upsert({
    ids: ["a", "b"],
    documents: ["father BP memory", "fever paracetamol guide"],
    embeddings: [
      [1, 0, 0],
      [0, 1, 0],
    ],
    metadatas: [
      { telegramId: "1", category: "memory" },
      { telegramId: "2", category: "symptoms" },
    ],
  });

  assert.equal(await collection.count(), 2);

  const reloaded = new LocalVectorCollection({ name: "test_collection", storagePath });
  const response = await reloaded.query({
    queryEmbeddings: [[1, 0, 0]],
    nResults: 2,
    where: { telegramId: "1" },
  });

  assert.deepEqual(response.documents[0], ["father BP memory"]);
  assert.equal(response.metadatas[0][0].category, "memory");

  fs.rmSync(storagePath, { recursive: true, force: true });
});
