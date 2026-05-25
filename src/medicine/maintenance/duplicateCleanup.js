const MedicineKnowledge = require("../../models/MedicineKnowledge");
const eventBus = require("../../events/eventBus");
const { normalizeQuery } = require("../../services/intentEngine");

const unique = (items = []) => [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
const normalizeArray = (items = []) => unique(items).map(normalizeQuery).filter(Boolean).sort();

const duplicateIdentityKey = (record = {}) => {
  const name = normalizeQuery(record.medicineName);
  const generic = normalizeQuery(record.genericName);
  const salts = normalizeArray(record.salts || []).join("+");
  const aliases = normalizeArray([...(record.aliases || []), ...(record.brands || []), ...(record.commonSpellings || [])]).join("+");
  return [generic || name, salts, aliases || name].filter(Boolean).join("|");
};

const mergeSideEffects = (left = [], right = []) => {
  const map = new Map();
  [...left, ...right].forEach((entry) => {
    const effect = typeof entry === "string" ? entry : entry?.effect;
    if (!effect) return;
    const key = normalizeQuery(effect);
    const previous = map.get(key) || {};
    map.set(key, {
      ...previous,
      ...(typeof entry === "string" ? { effect } : entry),
      confidence: Math.max(Number(previous.confidence || 0), Number(entry.confidence || 0.75)),
    });
  });
  return [...map.values()];
};

const mergeDuplicateRecords = (records = []) => {
  if (!records.length) return null;
  const sorted = [...records].sort((a, b) => {
    const aScore = Number(a.confidence || 0) + (a.sourceKind === "product_catalog" ? 0.2 : 0);
    const bScore = Number(b.confidence || 0) + (b.sourceKind === "product_catalog" ? 0.2 : 0);
    return bScore - aScore;
  });
  const canonical = { ...sorted[0] };
  sorted.slice(1).forEach((record) => {
    canonical.salts = unique([...(canonical.salts || []), ...(record.salts || [])]);
    canonical.brands = unique([...(canonical.brands || []), ...(record.brands || []), record.medicineName]);
    canonical.aliases = unique([...(canonical.aliases || []), ...(record.aliases || [])]);
    canonical.alternatives = unique([...(canonical.alternatives || []), ...(record.alternatives || [])]);
    canonical.symptoms = unique([...(canonical.symptoms || []), ...(record.symptoms || [])]);
    canonical.precautions = unique([...(canonical.precautions || []), ...(record.precautions || [])]);
    canonical.commonSpellings = unique([...(canonical.commonSpellings || []), ...(record.commonSpellings || [])]);
    canonical.sideEffects = mergeSideEffects(canonical.sideEffects || [], record.sideEffects || []);
    canonical.confidence = Math.max(Number(canonical.confidence || 0), Number(record.confidence || 0));
    if (!canonical.company && record.company) canonical.company = record.company;
  });
  return {
    canonicalId: sorted[0]._id,
    removeIds: sorted.slice(1).map((record) => record._id),
    merged: canonical,
  };
};

const findDuplicateGroups = async ({ limit = Number(process.env.DUPLICATE_CLEANUP_GROUP_LIMIT || 250) } = {}) => {
  const cursor = MedicineKnowledge.find()
    .select("medicineName genericName salts brands aliases commonSpellings alternatives symptoms sideEffects precautions confidence sourceKind company")
    .lean()
    .cursor();
  const groups = new Map();

  for await (const record of cursor) {
    const key = duplicateIdentityKey(record);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }

  return [...groups.entries()]
    .filter(([, records]) => records.length > 1)
    .slice(0, limit)
    .map(([key, records]) => ({ key, records }));
};

const cleanupMedicineDuplicates = async ({ dryRun = process.env.DUPLICATE_CLEANUP_APPLY !== "true", limit } = {}) => {
  const groups = await findDuplicateGroups({ limit });
  let duplicateRemovals = 0;
  let mergedGroups = 0;

  for (const group of groups) {
    const merged = mergeDuplicateRecords(group.records);
    if (!merged || !merged.removeIds.length) continue;
    duplicateRemovals += merged.removeIds.length;
    mergedGroups += 1;
    if (dryRun) continue;
    await MedicineKnowledge.updateOne(
      { _id: merged.canonicalId },
      {
        $set: {
          salts: merged.merged.salts,
          brands: merged.merged.brands,
          aliases: merged.merged.aliases,
          alternatives: merged.merged.alternatives,
          symptoms: merged.merged.symptoms,
          sideEffects: merged.merged.sideEffects,
          precautions: merged.merged.precautions,
          commonSpellings: merged.merged.commonSpellings,
          confidence: merged.merged.confidence,
          company: merged.merged.company,
          updatedAt: new Date(),
        },
      }
    );
    await MedicineKnowledge.deleteMany({ _id: { $in: merged.removeIds } });
  }

  const summary = {
    dryRun,
    duplicateGroups: groups.length,
    mergedGroups,
    duplicateRemovals,
  };
  eventBus.emitSafe("medicine.duplicates.cleanup.completed", summary);
  return summary;
};

module.exports = {
  cleanupMedicineDuplicates,
  duplicateIdentityKey,
  findDuplicateGroups,
  mergeDuplicateRecords,
};
