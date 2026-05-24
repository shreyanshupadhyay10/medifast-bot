const test = require("node:test");
const assert = require("node:assert/strict");
const { searchMedicineKnowledge } = require("../src/medicine/medicineKnowledgeService");
const { normalizeMedicineQuery } = require("../src/medicine/medicineNormalizer");

test("knowledge service refuses unknown medicines without inventing data", async () => {
  const result = await searchMedicineKnowledge({ query: "zzzzunknownmed", records: [] });

  assert.equal(result.medicine, null);
  assert.equal(result.message, "I could not confidently identify this medicine.");
});

test("normalizer handles curated alias without database", async () => {
  const result = await normalizeMedicineQuery("moda alert", { records: [] });

  assert.equal(result.normalizedQuery, "Modafinil");
  assert.equal(result.type, "medicine");
  assert.ok(result.confidence > 0.8);
});
