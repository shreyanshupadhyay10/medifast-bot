const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeMedicineQuery } = require("../src/medicine/medicineNormalizer");

const records = [
  {
    medicineName: "Demo LC",
    genericName: "Demo Salt",
    brands: ["Demo LC"],
    aliases: ["Demo-LC"],
    salts: ["Demo Salt"],
    category: "respiratory",
  },
];

test("suggests likely catalog medicine for misspelled unknown names", async () => {
  const result = await normalizeMedicineQuery("DemoXL", { records });

  assert.equal(result.type, "unknown");
  assert.equal(result.suggestions[0].medicineName, "Demo LC");
  assert.ok(result.suggestions[0].confidence > 0.25);
});

test("matches exact expanded catalog brand with or without spacing", async () => {
  const result = await normalizeMedicineQuery("DemoLC", { records });

  assert.equal(result.type, "medicine");
  assert.equal(result.normalizedQuery, "Demo Salt");
  assert.equal(result.method, "brands");
});
