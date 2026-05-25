const test = require("node:test");
const assert = require("node:assert/strict");
const { medicineKnowledgeToDocument } = require("../src/rag/medicineKnowledgeIngestion");

test("converts MedicineKnowledge side effects into RAG evidence document", () => {
  const doc = medicineKnowledgeToDocument({
    _id: "507f1f77bcf86cd799439011",
    knowledgeKey: "pregabalin",
    medicineName: "Pregabalin",
    genericName: "Pregabalin",
    category: "neurological",
    brands: ["Lyrica"],
    aliases: ["pregalin"],
    symptoms: ["Neuropathic pain"],
    sideEffects: [{ effect: "Dizziness", severity: "common", frequency: "common" }],
    precautions: ["Avoid driving if drowsy"],
    confidence: 0.91,
    source: "test",
  });

  assert.match(doc.text, /Known side effects/);
  assert.match(doc.text, /Dizziness/);
  assert.equal(doc.metadata.medicine, "Pregabalin");
  assert.equal(doc.metadata.generic, "Pregabalin");
  assert.equal(doc.metadata.category, "neurological");
  assert.match(doc.metadata.sideEffects, /Dizziness/);
});
