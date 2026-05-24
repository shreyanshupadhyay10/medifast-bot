const MedicineKnowledge = require("../../models/MedicineKnowledge");
const AnalyticsEvent = require("../../models/AnalyticsEvent");
const { rebuildMedicineKnowledgeIndex } = require("../medicineNormalizer");

const bucketConfidence = (value = 0) => {
  const confidence = Number(value) || 0;
  if (confidence >= 0.9) return "0.90-1.00";
  if (confidence >= 0.75) return "0.75-0.89";
  if (confidence >= 0.55) return "0.55-0.74";
  if (confidence > 0) return "0.01-0.54";
  return "0";
};

const countArrayValues = async (field) => {
  const [result] = await MedicineKnowledge.aggregate([
    { $project: { count: { $size: { $ifNull: [`$${field}`, []] } } } },
    { $group: { _id: null, total: { $sum: "$count" } } },
  ]);
  return result?.total || 0;
};

const duplicateGroups = async () =>
  MedicineKnowledge.aggregate([
    {
      $project: {
        identity: {
          $toLower: {
            $trim: {
              input: {
                $ifNull: ["$genericName", "$medicineName"],
              },
            },
          },
        },
      },
    },
    { $match: { identity: { $nin: [null, ""] } } },
    { $group: { _id: "$identity", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

const normalizationAnalytics = async () => {
  const [successful, failed, unknowns, confidenceRows] = await Promise.all([
    AnalyticsEvent.countDocuments({ eventType: "medicine.knowledge.normalized" }),
    AnalyticsEvent.countDocuments({ eventType: "medicine.knowledge.unknown" }),
    AnalyticsEvent.aggregate([
      { $match: { eventType: "medicine.knowledge.unknown", "metadata.query": { $exists: true, $ne: "" } } },
      { $group: { _id: "$metadata.query", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { query: "$_id", count: 1, _id: 0 } },
    ]),
    AnalyticsEvent.find({
      eventType: { $in: ["medicine.knowledge.normalized", "medicine.knowledge.unknown"] },
      "metadata.confidence": { $exists: true },
    })
      .select("metadata.confidence")
      .lean(),
  ]);

  const confidenceDistribution = confidenceRows.reduce((acc, row) => {
    const bucket = bucketConfidence(row.metadata?.confidence);
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {});

  return {
    successfulNormalization: successful,
    failedNormalization: failed,
    confidenceDistribution,
    topUnknownMedicines: unknowns,
  };
};

const diagnoseMedicineKnowledge = async () => {
  const [
    medicineRecords,
    totalAliases,
    totalBrands,
    totalSalts,
    missingMedicineName,
    missingGenericName,
    missingKnowledgeKey,
    duplicates,
    analytics,
  ] = await Promise.all([
    MedicineKnowledge.countDocuments(),
    countArrayValues("aliases"),
    countArrayValues("brands"),
    countArrayValues("salts"),
    MedicineKnowledge.countDocuments({ $or: [{ medicineName: { $exists: false } }, { medicineName: "" }] }),
    MedicineKnowledge.countDocuments({ $or: [{ genericName: { $exists: false } }, { genericName: "" }] }),
    MedicineKnowledge.countDocuments({ $or: [{ knowledgeKey: { $exists: false } }, { knowledgeKey: "" }] }),
    duplicateGroups(),
    normalizationAnalytics(),
  ]);
  const fuseIndex = await rebuildMedicineKnowledgeIndex();

  return {
    medicineRecords,
    totalAliases,
    totalBrands,
    totalSalts,
    fuseIndexSize: fuseIndex.count,
    missingFields: {
      medicineName: missingMedicineName,
      genericName: missingGenericName,
      knowledgeKey: missingKnowledgeKey,
    },
    duplicateMedicines: duplicates.reduce((sum, item) => sum + item.count - 1, 0),
    duplicateSamples: duplicates.map((item) => ({ name: item._id, count: item.count })),
    normalization: analytics,
  };
};

module.exports = {
  bucketConfidence,
  diagnoseMedicineKnowledge,
};
