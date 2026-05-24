const MedicineKnowledge = require("../../models/MedicineKnowledge");
const eventBus = require("../../events/eventBus");
const medicineCache = require("../../cache/medicineCache");
const { buildRelationships } = require("../medicineRelationshipService");
const { rebuildMedicineKnowledgeIndex } = require("../medicineNormalizer");
const { buildAutoAliases, normalizeList, validateKnowledgeRecord } = require("./knowledgeValidator");

const enrichMedicineKnowledge = async ({ limit = Number(process.env.MEDICINE_ENRICHMENT_LIMIT || 5000) } = {}) => {
  const cursor = MedicineKnowledge.find().limit(limit).cursor();
  const operations = [];
  const stats = {
    scanned: 0,
    valid: 0,
    invalid: 0,
    aliasesAdded: 0,
    missingRelationships: 0,
    duplicateKeys: 0,
    updated: 0,
  };
  const seenKeys = new Set();

  for await (const record of cursor) {
    stats.scanned += 1;
    const validation = validateKnowledgeRecord(record);
    if (!validation.valid) stats.invalid += 1;
    else stats.valid += 1;

    if (seenKeys.has(record.knowledgeKey)) stats.duplicateKeys += 1;
    seenKeys.add(record.knowledgeKey);

    const aliases = normalizeList(record.aliases);
    const expandedAliases = normalizeList([...aliases, ...buildAutoAliases(record)]);
    const relationships = buildRelationships(record);
    if (!relationships.length) stats.missingRelationships += 1;
    const added = expandedAliases.length - aliases.length;
    if (added > 0) stats.aliasesAdded += added;

    if (added > 0 || record.medicineNameLower !== record.medicineName.toLowerCase()) {
      operations.push({
        updateOne: {
          filter: { _id: record._id },
          update: {
            $set: {
              aliases: expandedAliases,
              brands: normalizeList(record.brands),
              salts: normalizeList(record.salts),
              commonSpellings: normalizeList(record.commonSpellings),
              medicineNameLower: record.medicineName.toLowerCase(),
              updatedAt: new Date(),
            },
          },
        },
      });
    }
  }

  if (operations.length) {
    const result = await MedicineKnowledge.bulkWrite(operations, { ordered: false });
    stats.updated = result.modifiedCount || 0;
  }

  medicineCache.clear();
  const index = await rebuildMedicineKnowledgeIndex();
  stats.fuseIndexSize = index.count;

  eventBus.emitSafe("medicine.knowledge.enrichment.completed", stats);
  return stats;
};

module.exports = {
  enrichMedicineKnowledge,
};
