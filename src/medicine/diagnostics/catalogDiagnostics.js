const MedicineKnowledge = require("../../models/MedicineKnowledge");
const AnalyticsEvent = require("../../models/AnalyticsEvent");
const { DEFAULT_COLLECTION, getCollection, getVectorMode, getVectorStoragePath } = require("../../rag/retriever");
const { readProgress, progressFilePath } = require("../../rag/medicineKnowledgeIngestion");

const calculateCoverage = ({ totalMedicines = 0, vectorizedMedicines = 0 } = {}) =>
  totalMedicines > 0 ? Number(((vectorizedMedicines / totalMedicines) * 100).toFixed(2)) : 0;

const calculateProgressCompletion = ({ totalMedicines = 0, processedRecords = 0, complete = false } = {}) => {
  if (complete) return 100;
  return totalMedicines > 0 ? Number(((processedRecords / totalMedicines) * 100).toFixed(2)) : 0;
};

const getMedicineVectorStats = async ({ collectionName = DEFAULT_COLLECTION, pageSize = Number(process.env.CATALOG_DIAGNOSTIC_VECTOR_PAGE_SIZE || 10000) } = {}) => {
  try {
    const collection = await getCollection(collectionName);
    const uniqueMedicines = new Set();
    let vectorizedChunks = 0;
    let identityChunks = 0;
    let offset = 0;

    while (true) {
      const page = await collection.get({
        where: { sourceType: "medicineKnowledge" },
        include: ["metadatas"],
        limit: pageSize,
        offset,
      });
      const ids = page.ids || [];
      const metadatas = page.metadatas || [];
      if (!ids.length) break;
      vectorizedChunks += ids.length;
      metadatas.forEach((metadata = {}) => {
        if (metadata.knowledgeKey) uniqueMedicines.add(metadata.knowledgeKey);
        if (metadata.chunkType === "identity") identityChunks += 1;
      });
      offset += ids.length;
      if (ids.length < pageSize) break;
    }

    return {
      available: true,
      vectorizedChunks,
      vectorizedMedicines: uniqueMedicines.size,
      identityChunks,
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      vectorizedChunks: 0,
      vectorizedMedicines: 0,
      identityChunks: 0,
      error: error.message,
    };
  }
};

const getDuplicateCount = async () => {
  const [result] = await MedicineKnowledge.aggregate([
    { $group: { _id: "$knowledgeKey", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $group: { _id: null, duplicateGroups: { $sum: 1 }, duplicateRecords: { $sum: { $subtract: ["$count", 1] } } } },
  ]);
  return {
    duplicateGroups: result?.duplicateGroups || 0,
    duplicateRecords: result?.duplicateRecords || 0,
  };
};

const getDistinctKnowledgeKeyCount = async () => {
  const [result] = await MedicineKnowledge.aggregate([
    { $group: { _id: "$knowledgeKey" } },
    { $count: "count" },
  ]).allowDiskUse(true);
  return result?.count || 0;
};

const getTopUnknownMedicines = async (limit = 10) =>
  AnalyticsEvent.aggregate([
    { $match: { eventType: { $in: ["medicine.knowledge.unknown", "medicine.lookup.failed"] } } },
    {
      $project: {
        query: {
          $ifNull: ["$metadata.query", "$metadata.normalizedQuery"],
        },
      },
    },
    { $match: { query: { $nin: [null, ""] } } },
    { $group: { _id: "$query", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { _id: 0, query: "$_id", count: 1 } },
  ]);

const diagnoseCatalog = async () => {
  const [totalMedicines, distinctKeys, duplicates, vectorStats, topUnknown] = await Promise.all([
    MedicineKnowledge.countDocuments(),
    getDistinctKnowledgeKeyCount(),
    getDuplicateCount(),
    getMedicineVectorStats(),
    getTopUnknownMedicines(),
  ]);
  const progress = readProgress();
  const progressCompletionPercent = calculateProgressCompletion({
    totalMedicines,
    processedRecords: progress?.processedRecords || 0,
    complete: Boolean(progress?.complete),
  });
  return {
    totalMedicines,
    distinctMedicines: distinctKeys,
    vectorMode: getVectorMode(),
    storagePath: getVectorStoragePath(),
    vectorizedMedicines: vectorStats.vectorizedMedicines,
    vectorizedChunks: vectorStats.vectorizedChunks,
    identityChunks: vectorStats.identityChunks,
    vectorAvailable: vectorStats.available,
    vectorError: vectorStats.error,
    coveragePercent: calculateCoverage({ totalMedicines, vectorizedMedicines: vectorStats.vectorizedMedicines }),
    duplicates,
    progressPath: progressFilePath(),
    progress,
    progressCompletionPercent,
    remainingRecords: Math.max(0, totalMedicines - (progress?.processedRecords || 0)),
    complete: Boolean(progress?.complete) || vectorStats.vectorizedMedicines >= totalMedicines,
    topUnknownMedicines: topUnknown,
  };
};

module.exports = {
  calculateCoverage,
  calculateProgressCompletion,
  diagnoseCatalog,
  getMedicineVectorStats,
};
