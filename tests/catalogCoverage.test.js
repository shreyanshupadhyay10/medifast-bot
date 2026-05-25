const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateCoverage } = require("../src/medicine/diagnostics/catalogDiagnostics");
const { medicineKnowledgeToChunks } = require("../src/rag/medicineKnowledgeIngestion");

test("calculates catalog vector coverage percentage", () => {
  assert.equal(calculateCoverage({ totalMedicines: 1000, vectorizedMedicines: 125 }), 12.5);
  assert.equal(calculateCoverage({ totalMedicines: 0, vectorizedMedicines: 125 }), 0);
});

test("creates optimized medicine identity, safety, and relationship chunks", () => {
  const chunks = medicineKnowledgeToChunks({
    _id: "507f1f77bcf86cd799439011",
    knowledgeKey: "montek lc",
    medicineName: "Montek LC",
    genericName: "Montelukast + Levocetirizine",
    brands: ["Montek LC"],
    aliases: ["MontekLC"],
    salts: ["Montelukast", "Levocetirizine"],
    symptoms: ["Allergy"],
    sideEffects: [{ effect: "Drowsiness" }],
    precautions: ["Avoid driving if sleepy"],
    alternatives: ["Montair LC"],
    category: "respiratory",
  });

  assert.deepEqual(chunks.map((chunk) => chunk.metadata.chunkType), ["identity", "safety", "relationships"]);
  assert.match(chunks[0].text, /Brands: Montek LC/);
  assert.match(chunks[1].text, /Drowsiness/);
  assert.match(chunks[2].text, /Alternatives: Montair LC/);
});
