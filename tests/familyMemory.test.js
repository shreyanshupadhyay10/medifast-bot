const test = require("node:test");
const assert = require("node:assert/strict");
const { extractEntities } = require("../src/ai/entityExtractor");
const { extractFactsFromEntities } = require("../src/services/memoryService");

test("family memory stores relationship, condition, medicine, and refill pattern", () => {
  const entities = extractEntities("reorder papa Dolo 650 medicine, papa has BP", {
    familyMembers: [{ name: "Papa", relation: "papa", ageGroup: "senior" }],
  });
  entities.reorderIntent = true;
  entities.medicine = "Dolo 650";
  entities.normalizedMedicineQuery = "Dolo 650";

  const facts = extractFactsFromEntities(entities);

  assert.equal(facts.some((fact) => fact.type === "family_relationship" && fact.entity === "papa"), true);
  assert.equal(facts.some((fact) => fact.type === "condition" && fact.value === "bp"), true);
  assert.equal(facts.some((fact) => fact.type === "family_medicine" && fact.value === "Dolo 650"), true);
  assert.equal(facts.some((fact) => fact.type === "refill_pattern" && fact.value === "Dolo 650"), true);
});
