const test = require("node:test");
const assert = require("node:assert/strict");
const {
  canonicalizeArray,
  normalizeMedicineQuery,
  normalizeMedicineRecord,
} = require("../src/medicine/medicineNormalizer");

test("normalizes medicine records from loose source fields", () => {
  const record = normalizeMedicineRecord({
    brand: "Crocin",
    salt: "Paracetamol",
    aliases: "pcm|fever tablet",
    prescriptionRequired: "false",
  });

  assert.equal(record.medicineName, "Crocin");
  assert.equal(record.genericName, "Paracetamol");
  assert.deepEqual(record.aliases, ["pcm", "fever tablet"]);
});

test("recognizes category aliases", async () => {
  const result = await normalizeMedicineQuery("sugar medicine", { records: [] });

  assert.equal(result.type, "category");
  assert.equal(result.normalizedQuery, "antidiabetic");
});

test("canonicalizeArray splits common source delimiters", () => {
  assert.deepEqual(canonicalizeArray("a,b|c;d"), ["a", "b", "c", "d"]);
});
