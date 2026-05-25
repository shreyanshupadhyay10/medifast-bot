const test = require("node:test");
const assert = require("node:assert/strict");
const { extractEntities } = require("../src/ai/entityExtractor");
const { routeMessage } = require("../src/ai/router");

test("detects side-effect intent and routes to medicine plus RAG", () => {
  const entities = extractEntities("side effects of Pregabalin");
  const routes = routeMessage({ entities });

  assert.equal(entities.intentType, "side_effects");
  assert.equal(entities.medicine, "Pregabalin");
  assert.equal(routes.some((route) => route.tool === "medicine"), true);
  assert.equal(routes.some((route) => route.tool === "rag" && route.confidence >= 0.9), true);
});

test("near me does not incorrectly create a self family route", () => {
  const entities = extractEntities("Dolo 650 near me");
  const routes = routeMessage({ entities });

  assert.equal(entities.intentType, "nearby");
  assert.equal(entities.person, null);
  assert.equal(routes.some((route) => route.tool === "nearby"), true);
});
