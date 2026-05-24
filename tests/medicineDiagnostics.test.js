const test = require("node:test");
const assert = require("node:assert/strict");
const MedicineKnowledge = require("../src/models/MedicineKnowledge");
const AnalyticsEvent = require("../src/models/AnalyticsEvent");
const { bucketConfidence, diagnoseMedicineKnowledge } = require("../src/medicine/diagnostics/knowledgeDiagnostics");

const restore = (target, originals) => {
  Object.entries(originals).forEach(([key, value]) => {
    target[key] = value;
  });
};

test("buckets medicine normalization confidence scores", () => {
  assert.equal(bucketConfidence(0.95), "0.90-1.00");
  assert.equal(bucketConfidence(0.8), "0.75-0.89");
  assert.equal(bucketConfidence(0.6), "0.55-0.74");
  assert.equal(bucketConfidence(0.2), "0.01-0.54");
  assert.equal(bucketConfidence(0), "0");
});

test("reports medicine knowledge diagnostics from model aggregates", async () => {
  const medicineOriginals = {
    countDocuments: MedicineKnowledge.countDocuments,
    aggregate: MedicineKnowledge.aggregate,
    find: MedicineKnowledge.find,
  };
  const analyticsOriginals = {
    countDocuments: AnalyticsEvent.countDocuments,
    aggregate: AnalyticsEvent.aggregate,
    find: AnalyticsEvent.find,
  };

  MedicineKnowledge.countDocuments = async (query) => {
    if (!query) return 10;
    if (JSON.stringify(query).includes("medicineName")) return 1;
    if (JSON.stringify(query).includes("genericName")) return 2;
    if (JSON.stringify(query).includes("knowledgeKey")) return 0;
    return 0;
  };
  MedicineKnowledge.aggregate = async (pipeline) => {
    const text = JSON.stringify(pipeline);
    if (text.includes("$size")) return [{ total: text.includes("aliases") ? 7 : text.includes("brands") ? 6 : 5 }];
    return [{ _id: "paracetamol", count: 3 }];
  };
  MedicineKnowledge.find = () => ({
    limit: () => ({
      lean: async () => [
        {
          medicineName: "Dolo",
          genericName: "Paracetamol",
          salts: ["Paracetamol"],
          brands: ["Dolo"],
          aliases: ["dolo"],
          commonSpellings: [],
        },
      ],
    }),
  });

  AnalyticsEvent.countDocuments = async (query) =>
    query.eventType === "medicine.knowledge.normalized" ? 4 : 2;
  AnalyticsEvent.aggregate = async () => [{ query: "unknown med", count: 2 }];
  AnalyticsEvent.find = () => ({
    select: () => ({
      lean: async () => [{ metadata: { confidence: 0.91 } }, { metadata: { confidence: 0.5 } }],
    }),
  });

  try {
    const report = await diagnoseMedicineKnowledge();
    assert.equal(report.medicineRecords, 10);
    assert.equal(report.totalAliases, 7);
    assert.equal(report.totalBrands, 6);
    assert.equal(report.totalSalts, 5);
    assert.equal(report.fuseIndexSize, 1);
    assert.equal(report.duplicateMedicines, 2);
    assert.equal(report.normalization.successfulNormalization, 4);
    assert.equal(report.normalization.failedNormalization, 2);
  } finally {
    restore(MedicineKnowledge, medicineOriginals);
    restore(AnalyticsEvent, analyticsOriginals);
  }
});
