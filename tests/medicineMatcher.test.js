const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildMedicineMatcherIndex,
  expandWithSynonyms,
  matchMedicine,
} = require("../src/medicine/matching/medicineMatcher");
const {
  diceSimilarity,
  normalizeIdentity,
  tokenOverlap,
  weightedConfidence,
} = require("../src/medicine/matching/confidenceScorer");

const medicines = [
  {
    _id: "1",
    medicineName: "Dolo 650 Tablet",
    genericName: "Paracetamol",
    salts: ["Paracetamol"],
    brands: ["Dolo", "Calpol"],
    aliases: ["pcm"],
    commonSpellings: ["paracetmol"],
  },
  {
    _id: "2",
    medicineName: "Azithral 500 Tablet",
    genericName: "Azithromycin",
    salts: ["Azithromycin"],
    brands: ["Azithral"],
    aliases: [],
    commonSpellings: ["azithromicin"],
  },
];

test("normalizes medicine identity noise before scoring", () => {
  assert.equal(normalizeIdentity("Isotretinoin (oral) Tablet"), "isotretinoin");
  assert.equal(diceSimilarity("azithromycin", "azithromicin") > 0.8, true);
  assert.equal(tokenOverlap("dolo paracetamol", "paracetamol tablet"), 0.5);
  assert.equal(weightedConfidence({ method: "genericName" }), 0.99);
});

test("expands curated medicine synonyms", () => {
  const expanded = expandWithSynonyms(["tylenol"]);

  assert.equal(expanded.includes("paracetamol"), true);
});

test("matches by priority from generic to salts, brands, aliases, spelling, and fuzzy", async () => {
  const index = buildMedicineMatcherIndex(medicines);

  assert.equal((await matchMedicine({ genericName: "Paracetamol" }, index)).method, "genericName");
  assert.equal((await matchMedicine({ medicineName: "Dolo" }, index)).method, "brands");
  assert.equal((await matchMedicine({ medicineName: "pcm" }, index)).method, "aliases");
  assert.equal((await matchMedicine({ medicineName: "paracetmol" }, index)).method, "commonSpellings");

  const fuzzy = await matchMedicine({ medicineName: "azithromicin 500" }, index);
  assert.equal(fuzzy.medicines[0].genericName, "Azithromycin");
  assert.equal(fuzzy.confidence >= 0.5, true);
});

test("matches non-Indian brand synonym to Indian generic record", async () => {
  const index = buildMedicineMatcherIndex(medicines);
  const match = await matchMedicine({ medicineName: "Tylenol" }, index);

  assert.equal(match.method, "synonym");
  assert.equal(match.medicines[0].genericName, "Paracetamol");
});
