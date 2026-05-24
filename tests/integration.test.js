const test = require("node:test");
const assert = require("node:assert/strict");
const { extractEntities } = require("../src/ai/entityExtractor");
const { routeMessage } = require("../src/ai/router");
const { assessSafety } = require("../src/ai/safetyGuard");

test("entity extraction, router, and safety layer work as one flow", () => {
  const profile = { familyMembers: [{ name: "Papa", relation: "papa", ageGroup: "senior" }] };
  const entities = extractEntities("Papa ko bukhar hai, Dolo near me", profile);
  const routes = routeMessage({ entities, profile });
  const safety = assessSafety({ entities, intent: entities.intent, query: entities.rawText, mentionedMember: profile.familyMembers[0] });

  assert.equal(entities.person, "papa");
  assert.equal(entities.nearbyIntent, true);
  assert.equal(routes.some((route) => route.tool === "medicine"), true);
  assert.equal(routes.some((route) => route.tool === "nearby"), true);
  assert.equal(safety.notes.some((note) => /seniors/i.test(note)), true);
});
