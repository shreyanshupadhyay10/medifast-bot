const test = require("node:test");
const assert = require("node:assert/strict");
const { chunkDocuments } = require("../src/rag/chunker");
const { rerank, overlapScore } = require("../src/rag/reranker");

test("chunks documents while preserving metadata", async () => {
  const chunks = await chunkDocuments(
    [
      {
        pageContent: "Fever guidance for children and seniors. ".repeat(80),
        metadata: {
          source: "guide_fever.md",
          category: "symptoms",
          trust: "high",
          updatedAt: "2026-05-23",
        },
      },
    ],
    { chunkSize: 200, chunkOverlap: 20 }
  );

  assert.ok(chunks.length > 1);
  assert.equal(chunks[0].metadata.category, "symptoms");
});

test("reranks using keyword overlap and category match", () => {
  const results = rerank(
    "fever child",
    [
      { text: "fever medicine guidance for child", metadata: { category: "symptoms" }, vectorScore: 0.1 },
      { text: "acidity tablet guide", metadata: { category: "medicines" }, vectorScore: 0.2 },
    ],
    { category: "symptoms" }
  );

  assert.equal(results[0].metadata.category, "symptoms");
  assert.ok(results[0].confidence > results[1].confidence);
  assert.equal(overlapScore("fever child", "child has fever"), 1);
});
