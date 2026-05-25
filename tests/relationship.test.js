const test = require("node:test");
const assert = require("node:assert/strict");
const { buildRefillRelationships, buildRelationships } = require("../src/medicine/medicineRelationshipService");

test("builds brand, symptom, and category graph relationships", () => {
  const relationships = buildRelationships({
    medicineName: "Dolo 650",
    genericName: "Paracetamol",
    brands: ["Dolo", "Crocin"],
    aliases: ["pcm"],
    symptoms: ["fever"],
    category: "painkiller",
  });

  const types = relationships.map((relationship) => relationship.type);
  assert.ok(types.includes("brand_generic"));
  assert.ok(types.includes("medicine_symptom"));
  assert.ok(types.includes("medicine_category"));
});

test("builds disease and refill relationships for product intelligence", () => {
  const relationships = buildRelationships({
    medicineName: "Telma AM",
    genericName: "Telmisartan + Amlodipine",
    diseases: ["hypertension"],
    refillPatterns: ["monthly_refill"],
  });
  const types = relationships.map((relationship) => relationship.type);

  assert.ok(types.includes("medicine_disease"));
  assert.ok(types.includes("disease_medicine"));
  assert.ok(types.includes("medicine_refill_pattern"));
});

test("builds family refill relationship edges", () => {
  const relationships = buildRefillRelationships({ medicineName: "Dolo 650", entity: "papa" });
  const types = relationships.map((relationship) => relationship.type);

  assert.ok(types.includes("family_refill_pattern"));
  assert.ok(types.includes("medicine_family_refill"));
});
