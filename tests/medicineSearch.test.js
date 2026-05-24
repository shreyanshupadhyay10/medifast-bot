const test = require("node:test");
const assert = require("node:assert/strict");
const { expandMedicineQuery } = require("../src/services/medicineAliasService");
const { searchMedicine } = require("../src/services/searchService");

test("normalizes Indian brand aliases to salt and related terms", () => {
  const modalert = expandMedicineQuery("moda alert");
  const ivak = expandMedicineQuery("ivak");

  assert.equal(modalert.normalizedQuery, "Modafinil");
  assert.ok(modalert.searchTerms.includes("Modalert"));
  assert.equal(ivak.normalizedQuery, "Ivabradine");
});

test("searchMedicine short query fallback does not hit database", async () => {
  const result = await searchMedicine("a");
  assert.deepEqual(result, { results: [], sos: false, query: "a" });
});
