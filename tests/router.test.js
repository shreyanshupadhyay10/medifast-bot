const test = require("node:test");
const assert = require("node:assert/strict");
const { extractEntities } = require("../src/ai/entityExtractor");
const { routeMessage } = require("../src/ai/router");

test("extracts family, symptom, and duration entities", () => {
  const entities = extractEntities("Papa ko kal se bukhar hai");

  assert.equal(entities.person, "papa");
  assert.equal(entities.symptom, "fever");
  assert.equal(entities.duration, "kal se");
});

test("returns ranked multi-tool routes", () => {
  const entities = extractEntities("papa fever medicine near me");
  const routes = routeMessage({ entities });
  const tools = routes.map((route) => route.tool);

  assert.equal(routes[0].tool, "family");
  assert.ok(tools.includes("medicine"));
  assert.ok(tools.includes("nearby"));
  assert.ok(routes.every((route, index) => index === 0 || routes[index - 1].confidence >= route.confidence));
});
