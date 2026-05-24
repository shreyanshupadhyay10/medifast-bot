const test = require("node:test");
const assert = require("node:assert/strict");
const { planWorkflow } = require("../src/orchestrator/workflowPlanner");

test("workflow planner exposes an ordered multi-tool sequence", () => {
  const plan = planWorkflow({
    query: "papa fever medicine near me",
    profile: { familyMembers: [{ name: "Papa", relation: "papa", ageGroup: "senior" }] },
    location: { latitude: 26.9124, longitude: 75.7873 },
  });

  assert.deepEqual(plan.toolSequence, ["family", "medicineKnowledge", "memory", "knowledge", "nearby"]);
  assert.equal(plan.execute.nearby, true);
});
