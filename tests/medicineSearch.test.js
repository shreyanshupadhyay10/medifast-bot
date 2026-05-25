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

test("curated medicine aliases resolve common Indian brands without live inventory", async () => {
  const cases = [
    ["Dolo 650", "Paracetamol"],
    ["pregabalin", "Pregabalin"],
    ["alprax", "Alprazolam"],
    ["Clonazapam", "Clonazepam"],
    ["Pantoprazole", "Pantoprazole"],
  ];

  for (const [query, genericName] of cases) {
    const result = await searchMedicine(query);
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].genericName, genericName);
    assert.equal(result.results[0].knowledgeOnly, true);
    assert.equal(result.sos, false);
  }
});

test("raw Hinglish symptom query normalizes inside search service", async () => {
  process.env.ENABLE_LIVE_INVENTORY_SEARCH = "false";
  const { searchMedicine } = require("../src/services/searchService");
  const result = await searchMedicine("bukhar ki tablet");

  assert.equal(result.results.length > 0, true);
  assert.match(result.results[0].genericName || result.results[0].medicineName, /Paracetamol/i);
});
