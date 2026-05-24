const test = require("node:test");
const assert = require("node:assert/strict");
const {
  detectSideEffectsFieldMap,
  mapSideEffectsRecord,
  validateSideEffectsRecord,
} = require("../src/medicine/enrichment/sideEffectsMapper");
const {
  buildMedicineMatchIndex,
  buildSideEffectEntry,
  matchMedicineRecords,
} = require("../src/medicine/enrichment/sideEffectsEnricher");
const { buildRelationships } = require("../src/medicine/medicineRelationshipService");

test("detects drugs.com side effects CSV fields without assuming column names", () => {
  const row = {
    drug_name: "azithromycin",
    medical_condition: "Acne",
    side_effects: "Common side effects may include nausea.",
    generic_name: "azithromycin",
    drug_classes: "Macrolides",
    brand_names: "Zithromax, Zithromax Tri-Pak",
    drug_link: "https://www.drugs.com/azithromycin.html",
  };

  const fieldMap = detectSideEffectsFieldMap(Object.keys(row));
  const mapped = mapSideEffectsRecord(row, fieldMap);

  assert.deepEqual(fieldMap, {
    medicineName: "drug_name",
    genericName: "generic_name",
    sideEffects: "side_effects",
    source: "drug_link",
    brand: "brand_names",
  });
  assert.equal(mapped.medicineName, "azithromycin");
  assert.equal(mapped.genericName, "azithromycin");
  assert.equal(mapped.sideEffects, "Common side effects may include nausea.");
  assert.deepEqual(mapped.brands, ["Zithromax", "Zithromax Tri-Pak"]);
  assert.equal(mapped.source, "https://www.drugs.com/azithromycin.html");
});

test("validates side effect rows before enrichment", () => {
  assert.equal(validateSideEffectsRecord({ medicineName: "A", sideEffects: "nausea" }).valid, true);
  const result = validateSideEffectsRecord({ medicineName: "A" });

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, ["Missing side effects text."]);
});

test("matches side effects to medicine knowledge by generic, salts, aliases, and spellings", async () => {
  const medicines = [
    {
      _id: "1",
      medicineName: "Azithral 500 Tablet",
      genericName: "Azithromycin",
      salts: ["Azithromycin"],
      brands: ["Azithral 500 Tablet"],
      aliases: ["azithro"],
      commonSpellings: ["azithromicin"],
    },
  ];
  const matchIndex = buildMedicineMatchIndex(medicines);

  assert.equal((await matchMedicineRecords({ genericName: "azithromycin" }, matchIndex)).confidence, 0.99);
  assert.equal((await matchMedicineRecords({ medicineName: "azithromicin" }, matchIndex)).medicines.length, 1);
  assert.equal((await matchMedicineRecords({ medicineName: "unknown med" }, matchIndex)).confidence, 0);
});

test("builds side effect entries and relationship graph without inventing fields", () => {
  const entry = buildSideEffectEntry(
    {
      sideEffects: "nausea and stomach pain",
      severity: null,
      frequency: null,
      source: "https://example.test/drug",
    },
    0.95
  );

  assert.deepEqual(entry, {
    effect: "nausea and stomach pain",
    severity: null,
    frequency: null,
    source: "https://example.test/drug",
    confidence: 0.95,
  });

  const relationships = buildRelationships({
    genericName: "Azithromycin",
    company: "Alembic Pharmaceuticals Ltd",
    sideEffects: [entry],
  });

  assert.equal(relationships.some((item) => item.type === "medicine_side_effect"), true);
  assert.equal(relationships.some((item) => item.type === "medicine_manufacturer"), true);
});
