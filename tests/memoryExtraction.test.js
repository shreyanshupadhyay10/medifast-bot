const test = require("node:test");
const assert = require("node:assert/strict");
const { extractEntities } = require("../src/ai/entityExtractor");
const { extractFactsFromEntities } = require("../src/services/memoryService");

test("extracts family condition facts for father", () => {
  const entities = extractEntities("Papa has BP and diabetes", {
    familyMembers: [{ name: "Papa", relation: "papa", ageGroup: "senior" }],
  });
  const facts = extractFactsFromEntities(entities);

  assert.equal(entities.person, "papa");
  assert.equal(facts.some((fact) => fact.entity === "papa" && fact.type === "condition" && fact.value === "bp"), true);
  assert.equal(facts.some((fact) => fact.entity === "papa" && fact.type === "condition" && fact.value === "diabetes"), true);
});

test("extracts medicine context facts", () => {
  const entities = extractEntities("mother acidity medicine pantoprazole");
  const facts = extractFactsFromEntities(entities);

  assert.equal(facts.some((fact) => fact.type === "medicine_context"), true);
});
