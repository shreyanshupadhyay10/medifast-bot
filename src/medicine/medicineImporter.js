const MedicineKnowledge = require("../models/MedicineKnowledge");
const eventBus = require("../events/eventBus");
const medicineCache = require("../cache/medicineCache");
const { loadSources } = require("./sources/sourceManager");
const { validateDataset } = require("./sources/datasetValidator");
const { mergeDataset } = require("./sources/datasetMerger");
const { rebuildMedicineKnowledgeIndex } = require("./medicineNormalizer");

const upsertMedicineRecords = async (records = []) => {
  if (!records.length) return { imported: 0 };

  const batchSize = Number(process.env.MEDICINE_IMPORT_BATCH_SIZE || 1000);
  let imported = 0;
  let upserted = 0;
  let modified = 0;

  for (let start = 0; start < records.length; start += batchSize) {
    const batch = records.slice(start, start + batchSize);
    const operations = batch.map((record) => ({
      updateOne: {
        filter: { knowledgeKey: record.knowledgeKey },
        update: {
          $set: {
            ...record,
            medicineNameLower: record.medicineName.toLowerCase(),
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await MedicineKnowledge.bulkWrite(operations, { ordered: false });
    imported += result.upsertedCount + result.modifiedCount;
    upserted += result.upsertedCount;
    modified += result.modifiedCount;
  }

  return {
    imported,
    upserted,
    modified,
  };
};

const importMedicineSources = async ({ root, defaults = {} } = {}) => {
  const sources = loadSources(root);
  const allRecords = [];
  const failed = [];

  sources.forEach((source) => {
    const validation = validateDataset(source.records);
    validation.valid.forEach((record) => {
      allRecords.push({
        ...record,
        source: record.source || source.sourceName,
      });
    });
    validation.failed.forEach((item) => {
      failed.push({ ...item, source: source.sourceName });
    });
  });

  const merged = mergeDataset(allRecords, defaults);
  const result = await upsertMedicineRecords(merged.records);
  medicineCache.clear();
  const index = await rebuildMedicineKnowledgeIndex(merged.records);

  const summary = {
    sourceCount: sources.length,
    rawRecords: allRecords.length + failed.length,
    validRecords: allRecords.length,
    failedRecords: failed.length,
    duplicateRemovals: merged.duplicateCount,
    importedMedicineCount: result.imported,
    upserted: result.upserted,
    modified: result.modified,
    fuseIndexRecords: index.count,
  };

  eventBus.emitSafe("medicine.import.completed", summary);
  return { ...summary, failed };
};

module.exports = {
  importMedicineSources,
  upsertMedicineRecords,
};
