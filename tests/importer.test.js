const test = require("node:test");
const assert = require("node:assert/strict");
const { detectFieldMap, mapRecordFields } = require("../src/medicine/sources/fieldMapper");
const { validateDataset } = require("../src/medicine/sources/datasetValidator");
const { mergeDataset } = require("../src/medicine/sources/datasetMerger");

test("validates records and captures failed rows", () => {
  const result = validateDataset([{ medicineName: "Dolo" }, { confidence: 2 }]);

  assert.equal(result.valid.length, 1);
  assert.equal(result.failed.length, 1);
});

test("merges brand and generic duplicates into one normalized medicine", () => {
  const result = mergeDataset([
    { medicineName: "Paracetamol", genericName: "Paracetamol", brands: ["Dolo"] },
    { medicineName: "Crocin", genericName: "Paracetamol", brands: ["Crocin"] },
  ]);

  assert.equal(result.records.length, 1);
  assert.equal(result.duplicateCount, 1);
  assert.deepEqual(result.records[0].brands, ["Dolo", "Crocin"]);
});

test("auto maps Indian medicine CSV schema without assuming column names", () => {
  const row = {
    id: "1",
    name: "Augmentin 625 Duo Tablet",
    "price(₹)": "223.42",
    Is_discontinued: "FALSE",
    manufacturer_name: "Glaxo SmithKline Pharmaceuticals Ltd",
    type: "allopathy",
    pack_size_label: "strip of 10 tablets",
    short_composition1: "Amoxycillin (500mg)",
    short_composition2: "Clavulanic Acid (125mg)",
  };

  const fieldMap = detectFieldMap(Object.keys(row));
  const mapped = mapRecordFields(row, fieldMap);

  assert.deepEqual(fieldMap, {
    medicineName: "name",
    salt: ["short_composition1", "short_composition2"],
    company: "manufacturer_name",
    category: "type",
  });
  assert.equal(mapped.medicineName, "Augmentin 625 Duo Tablet");
  assert.equal(mapped.genericName, "Amoxycillin + Clavulanic Acid");
  assert.deepEqual(mapped.salts, ["Amoxycillin", "Clavulanic Acid"]);
  assert.deepEqual(mapped.brands, ["Augmentin 625 Duo Tablet"]);
  assert.equal(mapped.company, "Glaxo SmithKline Pharmaceuticals Ltd");
  assert.equal(mapped.category, "allopathy");
  assert.equal(mapped.sideEffects, null);
  assert.equal(mapped.sourceKind, "product_catalog");
});

test("keeps product catalog rows separate while linking them to generic salts", () => {
  const result = mergeDataset([
    {
      medicineName: "Azithral 500 Tablet",
      genericName: "Azithromycin",
      salts: ["Azithromycin"],
      company: "Alembic Pharmaceuticals Ltd",
      brands: ["Azithral 500 Tablet"],
      sourceKind: "product_catalog",
    },
    {
      medicineName: "Zithromax 500mg Tablet",
      genericName: "Azithromycin",
      salts: ["Azithromycin"],
      company: "Pfizer Ltd",
      brands: ["Zithromax 500mg Tablet"],
      sourceKind: "product_catalog",
    },
  ]);

  assert.equal(result.records.length, 2);
  assert.equal(result.duplicateCount, 0);
  assert.equal(result.records[0].genericName, "Azithromycin");
});
