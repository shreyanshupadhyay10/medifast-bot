const test = require("node:test");
const assert = require("node:assert/strict");
const { distanceToConfidence } = require("../src/rag/retriever");
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
