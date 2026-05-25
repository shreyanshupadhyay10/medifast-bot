const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { LocalVectorCollection } = require("../src/rag/localVectorStore");

test("local vector collection can page MedicineKnowledge metadata for coverage diagnostics", async (t) => {
  const storagePath = fs.mkdtempSync(path.join(os.tmpdir(), "medifast-vector-"));
  t.after(() => fs.rmSync(storagePath, { recursive: true, force: true }));

  const collection = new LocalVectorCollection({ name: "coverage_test", storagePath });
  await collection.upsert({
    ids: ["m1-identity", "m1-safety", "m2-identity"],
    documents: ["identity", "safety", "identity"],
    embeddings: [[1, 0], [0.9, 0.1], [0, 1]],
    metadatas: [
      { sourceType: "medicineKnowledge", chunkType: "identity", knowledgeKey: "m1" },
      { sourceType: "medicineKnowledge", chunkType: "safety", knowledgeKey: "m1" },
      { sourceType: "medicineKnowledge", chunkType: "identity", knowledgeKey: "m2" },
    ],
  });

  const page = await collection.get({
    where: { sourceType: "medicineKnowledge" },
    include: ["metadatas"],
    limit: 2,
    offset: 1,
  });

  assert.deepEqual(page.ids, ["m1-safety", "m2-identity"]);
  assert.equal(page.metadatas[1].knowledgeKey, "m2");
});
