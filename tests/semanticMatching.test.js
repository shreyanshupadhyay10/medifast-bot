const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildMedicineMatcherIndex,
  cosineSimilarity,
  matchMedicine,
  semanticMatch,
} = require("../src/medicine/matching/medicineMatcher");

const fakeEmbeddingProvider = {
  async embedQuery(text) {
    const normalized = String(text || "").toLowerCase();
    if (normalized.includes("paracetamol") || normalized.includes("pain relief")) return [1, 0, 0];
    if (normalized.includes("azithromycin") || normalized.includes("antibiotic")) return [0, 1, 0];
    return [0, 0, 1];
  },
};

test("computes cosine similarity for medicine semantic vectors", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});

test("semantic matcher can retrieve candidate medicine using embedding provider", async () => {
  const index = buildMedicineMatcherIndex([
    {
      _id: "1",
      medicineName: "Dolo 650 Tablet",
      genericName: "Paracetamol",
      salts: ["Paracetamol"],
      brands: ["Dolo"],
    },
  ]);

  const matches = await semanticMatch(
    { medicineName: "pain relief fever tablet" },
    index,
    { embeddingProvider: fakeEmbeddingProvider, limit: 1 }
  );

  const [match] = Array.from(matches.values());
  assert.equal(match.medicine.genericName, "Paracetamol");
  assert.equal(match.method, "semantic");
});

test("matchMedicine can optionally use semantic matching after weak deterministic matching", async () => {
  const index = buildMedicineMatcherIndex([
    {
      _id: "1",
      medicineName: "Dolo 650 Tablet",
      genericName: "Paracetamol",
      salts: ["Paracetamol"],
      brands: ["Dolo"],
    },
  ]);

  const match = await matchMedicine(
    { medicineName: "pain relief fever tablet" },
    index,
    { useSemantic: true, embeddingProvider: fakeEmbeddingProvider }
  );

  assert.equal(match.usedSemantic, true);
  assert.equal(match.medicines[0].genericName, "Paracetamol");
});
