const test = require("node:test");
const assert = require("node:assert/strict");
const { extractEntities } = require("../src/ai/entityExtractor");
const { routeMessage } = require("../src/ai/router");
const { expandMedicineQuery } = require("../src/services/medicineAliasService");

const aliasCases = [
  ["Dolo 650", "Paracetamol"],
  ["Pregabalin", "Pregabalin"],
  ["MontekLC", "Montelukast + Levocetirizine"],
  ["Pantocid", "Pantoprazole"],
  ["Telma AM", "Telmisartan + Amlodipine"],
  ["Aciloc", "Ranitidine"],
  ["Glycomet GP", "Metformin + Glimepiride"],
  ["clonazapam", "Clonazepam"],
];

aliasCases.forEach(([query, salt]) => {
  test(`normalizes common real-world medicine query: ${query}`, () => {
    const expanded = expandMedicineQuery(query);
    assert.equal(expanded.alias.salt, salt);
  });
});

test("headache tablet near me routes medicine, nearby, and RAG context", () => {
  const entities = extractEntities("headache tablet near me");
  const routes = routeMessage({ entities });
  const tools = routes.map((route) => route.tool);

  assert.equal(entities.symptom, "headache");
  assert.equal(entities.nearbyIntent, true);
  assert.equal(entities.normalizedMedicineQuery, "Paracetamol");
  assert.equal(tools.includes("medicine"), true);
  assert.equal(tools.includes("nearby"), true);
  assert.equal(tools.includes("rag"), true);
});

test("family condition message stores context instead of pretending it is a medicine", () => {
  const entities = extractEntities("Papa has BP and diabetes");

  assert.equal(entities.person, "papa");
  assert.equal(entities.condition, "bp");
  assert.equal(entities.medicine, null);
  assert.equal(entities.intentType, "family_context");
});

test("generic medicine for papa becomes memory/family flow", () => {
  const entities = extractEntities("medicine for papa");
  const routes = routeMessage({ entities });

  assert.equal(entities.person, "papa");
  assert.equal(entities.medicine, null);
  assert.equal(routes.some((route) => route.tool === "family"), true);
});

test("side effects of Pregabalin routes to medicine plus trusted knowledge", () => {
  const entities = extractEntities("side effects of Pregabalin");
  const routes = routeMessage({ entities });

  assert.equal(entities.intentType, "side_effects");
  assert.equal(entities.medicine, "Pregabalin");
  assert.equal(routes.some((route) => route.tool === "medicine"), true);
  assert.equal(routes.some((route) => route.tool === "rag"), true);
});
