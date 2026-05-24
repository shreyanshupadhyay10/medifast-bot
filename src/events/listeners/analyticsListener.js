const logger = require("../../utils/logger");
const AnalyticsEvent = require("../../models/AnalyticsEvent");

const record = async (eventType, metadata = {}) => {
  try {
    await AnalyticsEvent.create({
      eventType,
      telegramId: metadata.telegramId ? String(metadata.telegramId) : undefined,
      metadata,
    });
  } catch (error) {
    logger.error(`Analytics persistence error: ${error.message}`);
  }
};

const registerAnalyticsListener = (eventBus) => {
  eventBus.on("search.completed", ({ normalizedQuery, intentKey, telegramId }) => {
    logger.info(`Analytics event search.completed user=${telegramId} query="${normalizedQuery}" intent=${intentKey || "unknown"}`);
    record("search.completed", { normalizedQuery, intentKey, telegramId });
  });

  eventBus.on("nearby.completed", ({ telegramId, resultCount, radiusKm }) => {
    logger.info(`Analytics event nearby.completed user=${telegramId} results=${resultCount} radiusKm=${radiusKm}`);
    record("nearby.completed", { telegramId, resultCount, radiusKm });
  });

  eventBus.on("location.permission.accepted", (payload) => {
    logger.info(`Analytics event location.permission.accepted user=${payload.telegramId}`);
    record("location.permission.accepted", payload);
  });

  eventBus.on("pharmacy.location.search.completed", (payload) => {
    logger.info(`Analytics event pharmacy.location.search.completed results=${payload.resultCount} radiusKm=${payload.radiusKm}`);
    record("pharmacy.location.search.completed", payload);
  });

  eventBus.on("pharmacy.ranking.completed", (payload) => {
    logger.info(`Analytics event pharmacy.ranking.completed results=${payload.resultCount} inventory=${payload.inventoryMatchCount}`);
    record("pharmacy.ranking.completed", payload);
  });

  eventBus.on("retrieval.completed", ({ type, query, hitCount, error }) => {
    logger.info(`Analytics event retrieval.completed type=${type} hits=${hitCount}`);
    record("retrieval.completed", { type, query, hitCount, error });
  });

  eventBus.on("orchestration.completed", (payload) => {
    logger.info(
      `Analytics event orchestration.completed tools=${payload.toolCount || 0} provider=${payload.provider || "unknown"} latency=${payload.orchestrationLatencyMs || 0}ms`
    );
    record("orchestration.completed", payload);
  });

  eventBus.on("medicine.lookup.failed", ({ telegramId, query, normalizedQuery, intentKey }) => {
    logger.info(`Analytics event medicine.lookup.failed user=${telegramId} query="${normalizedQuery || query}"`);
    record("medicine.lookup.failed", { telegramId, query, normalizedQuery, intentKey });
  });

  eventBus.on("medicine.knowledge.normalized", (payload) => {
    logger.info(`Analytics event medicine.knowledge.normalized query="${payload.query}" normalized="${payload.normalizedQuery}"`);
    record("medicine.knowledge.normalized", payload);
  });

  eventBus.on("medicine.knowledge.unknown", (payload) => {
    logger.info(`Analytics event medicine.knowledge.unknown query="${payload.query}"`);
    record("medicine.knowledge.unknown", payload);
  });

  eventBus.on("medicine.import.completed", (payload) => {
    logger.info(`Analytics event medicine.import.completed imported=${payload.importedMedicineCount}`);
    record("medicine.import.completed", payload);
  });

  eventBus.on("medicine.knowledge.enrichment.completed", (payload) => {
    logger.info(`Analytics event medicine.knowledge.enrichment.completed updated=${payload.updated} aliasesAdded=${payload.aliasesAdded}`);
    record("medicine.knowledge.enrichment.completed", payload);
  });

  eventBus.on("medicine.side_effects.enrichment.completed", (payload) => {
    logger.info(
      `Analytics event medicine.side_effects.enrichment.completed matched=${payload.matchedRecords} unmatched=${payload.unmatchedRecords}`
    );
    record("medicine.side_effects.enrichment.completed", payload);
  });

  eventBus.on("pharmacy.import.completed", (payload) => {
    logger.info(
      `Analytics event pharmacy.import.completed city=${payload.city} imported=${payload.importedPharmacyCount} duplicates=${payload.duplicateRemovals}`
    );
    record("pharmacy.import.completed", payload);
  });
};

module.exports = {
  registerAnalyticsListener,
};
