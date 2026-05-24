const Pharmacy = require("../../models/Pharmacy");
const eventBus = require("../../events/eventBus");
const { getCityConfig } = require("../../../config/cities");
const { fetchOsmPharmacies } = require("./osmPharmacySource");
const { normalizeOsmPharmacy } = require("./datasetNormalizer");
const { validateDataset } = require("./datasetValidator");
const { identityFor, mergeDataset } = require("./datasetMerger");

const ensurePharmacyIndexes = async () => {
  await Pharmacy.collection.createIndex({ location: "2dsphere" }, { sparse: true });
  await Pharmacy.collection.createIndex({ geoLocation: "2dsphere" }, { sparse: true });
  await Pharmacy.collection.createIndex({ city: 1, name: 1 });
};

const upsertPharmacies = async (records = []) => {
  if (!records.length) return { imported: 0, upserted: 0, modified: 0 };

  const operations = records.map((record) => ({
    updateOne: {
      filter: record.sourceMetadata?.osmId
        ? { "sourceMetadata.osmId": record.sourceMetadata.osmId, source: record.source }
        : { name: record.name, city: record.city, area: record.area },
      update: {
        $set: {
          ...record,
          lastVerified: new Date(),
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  const result = await Pharmacy.bulkWrite(operations, { ordered: false });
  return {
    imported: result.upsertedCount + result.modifiedCount,
    upserted: result.upsertedCount,
    modified: result.modifiedCount,
  };
};

const importPharmaciesForCity = async ({ cityName = "Jaipur", fetchImpl, dryRun = false } = {}) => {
  const city = getCityConfig(cityName);
  const osm = await fetchOsmPharmacies({ city, fetchImpl });
  const normalized = osm.records.map((record) =>
    normalizeOsmPharmacy(record, {
      cityName: city.name,
      sourceName: osm.sourceName,
      datasetVersion: osm.datasetVersion,
    })
  );
  const validation = validateDataset(normalized);
  const merged = mergeDataset(validation.valid);
  const result = dryRun ? { imported: 0, upserted: 0, modified: 0 } : await upsertPharmacies(merged.records);

  if (!dryRun) {
    await ensurePharmacyIndexes();
  }

  const summary = {
    city: city.name,
    source: osm.sourceName,
    datasetVersion: osm.datasetVersion,
    rawRecords: osm.records.length,
    validRecords: validation.valid.length,
    failedImports: validation.failed.length,
    coordinateIssues: validation.coordinateIssues.length,
    duplicateRemovals: merged.duplicateCount,
    importedPharmacyCount: result.imported,
    upserted: result.upserted,
    modified: result.modified,
    cityCoverage: {
      lat: city.lat,
      lng: city.lng,
      radiusKm: city.radiusKm,
      validPharmacies: merged.records.length,
    },
  };

  eventBus.emitSafe("pharmacy.import.completed", summary);
  return {
    ...summary,
    failed: validation.failed,
    records: merged.records,
  };
};

module.exports = {
  ensurePharmacyIndexes,
  identityFor,
  importPharmaciesForCity,
  upsertPharmacies,
};
