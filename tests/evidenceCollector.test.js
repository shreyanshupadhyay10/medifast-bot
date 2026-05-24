const test = require("node:test");
const assert = require("node:assert/strict");
const { collectEvidence, estimateEvidenceSize } = require("../src/orchestrator/evidenceCollector");

test("collects compact evidence from deterministic tool outputs", () => {
  const evidence = collectEvidence({
    query: "papa has BP and find Dolo near me",
    plan: {
      entities: { person: "papa", symptom: "fever", nearbyIntent: true },
      routes: [{ tool: "medicine", confidence: 0.91 }],
    },
    toolResults: {
      medicineKnowledge: {
        ok: true,
        value: {
          medicine: { medicineName: "Dolo 650", genericName: "Paracetamol", brands: ["Dolo"], salts: ["Paracetamol"] },
          relationships: [{ type: "brand_generic", from: "Dolo", to: "Paracetamol" }],
          confidence: 0.92,
        },
      },
      memory: { ok: true, value: { facts: [{ type: "condition", entity: "papa", value: "BP", confidence: 0.8 }] } },
      knowledge: { ok: true, value: { context: [{ text: "Fever safety", metadata: { source: "fever.md" } }], confidence: 0.7 } },
      nearby: { ok: true, value: { radiusKm: 5, ranked: [{ name: "Apollo", distanceKm: 1.2, score: 0.8 }] } },
    },
  });

  assert.equal(evidence.userQuery, "papa has BP and find Dolo near me");
  assert.equal(evidence.medicineContext.medicine.genericName, "Paracetamol");
  assert.equal(evidence.medicineContext.relationships.length, 1);
  assert.equal(evidence.memoryContext.facts[0].value, "BP");
  assert.equal(evidence.ragContext.context[0].source, "fever.md");
  assert.equal(evidence.pharmacyContext.pharmacies[0].name, "Apollo");
  assert.equal(evidence.confidenceScores.medicine, 0.92);
  assert.equal(estimateEvidenceSize(evidence) > 0, true);
});
