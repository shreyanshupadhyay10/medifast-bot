const test = require("node:test");
const assert = require("node:assert/strict");
const { collectEvidence } = require("../src/orchestrator/evidenceCollector");

test("evidence collector carries relationship graph and pharmacy confidence", () => {
  const evidence = collectEvidence({
    query: "side effects of Pregabalin",
    plan: {
      entities: { intentType: "side_effects", medicine: "Pregabalin" },
      routes: [{ tool: "rag", confidence: 0.92 }],
    },
    toolResults: {
      medicineKnowledge: {
        ok: true,
        value: {
          medicine: { medicineName: "Pregabalin", genericName: "Pregabalin", sideEffects: [{ effect: "Dizziness" }] },
          relationships: [{ type: "medicine_side_effect", from: "Pregabalin", to: "Dizziness" }],
          confidence: 0.9,
        },
      },
      knowledge: { ok: true, value: { context: [{ text: "Pregabalin side effects include dizziness.", metadata: { source: "MedicineKnowledge", category: "neurological" } }], confidence: 0.8 } },
      nearby: { ok: true, value: { ranked: [{ name: "Dawa Dost", inventoryConfidence: 0.82, score: 0.7 }] } },
    },
  });

  assert.equal(evidence.medicineContext.relationships[0].type, "medicine_side_effect");
  assert.equal(evidence.ragContext.context[0].category, "neurological");
  assert.equal(evidence.pharmacyContext.pharmacies[0].inventoryConfidence, 0.82);
});
