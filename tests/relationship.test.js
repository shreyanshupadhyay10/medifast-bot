const test = require("node:test");
const assert = require("node:assert/strict");
const { buildRelationships } = require("../src/medicine/medicineRelationshipService");

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
