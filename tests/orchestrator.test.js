const test = require("node:test");
const assert = require("node:assert/strict");
const { planWorkflow } = require("../src/orchestrator/workflowPlanner");
const { mergeWorkflowResponse } = require("../src/orchestrator/responseMerger");

test("plans multi-tool workflow without replacing deterministic router", () => {
  const plan = planWorkflow({
    query: "papa fever medicine near me",
    profile: { familyMembers: [{ name: "Papa", relation: "papa", ageGroup: "senior" }] },
    location: { latitude: 26.9124, longitude: 75.7873 },
  });

  assert.equal(plan.execute.family, true);
  assert.equal(plan.execute.medicine, true);
  assert.equal(plan.execute.memory, true);
  assert.equal(plan.execute.nearby, true);
  assert.equal(plan.execute.rag, true);
});

test("merges tool outputs with safety and debug traces", () => {
  const plan = planWorkflow({ query: "fever medicine", profile: {} });
  const merged = mergeWorkflowResponse({
    query: "fever medicine",
    plan,
    intent: { key: "fever" },
    toolResults: {
      medicineKnowledge: { ok: true, value: { medicine: { genericName: "Paracetamol" }, confidence: 0.9 } },
      knowledge: { ok: true, value: { context: [{ text: "fever safety", metadata: { source: "fever.md" } }], confidence: 0.8 } },
      memory: { ok: true, value: { facts: [{ entity: "papa", value: "BP" }] } },
    },
    providerResult: { text: "Use discovered medicine info safely.", provider: "deterministic" },
  });

  assert.equal(merged.medicine.genericName, "Paracetamol");
  assert.equal(merged.knowledge.context.length, 1);
  assert.equal(merged.memory.length, 1);
  assert.equal(merged.debug.tools.knowledge, true);
  assert.equal(merged.safety.notes.some((note) => /doctor/i.test(note)), true);
});
