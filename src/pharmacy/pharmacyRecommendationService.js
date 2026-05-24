const { searchMedicineKnowledge } = require("../medicine/medicineKnowledgeService");
const eventBus = require("../events/eventBus");
const { findInventoryMatches } = require("./pharmacyAvailabilityService");
const { rankPharmacies } = require("./pharmacyRankingService");
const { recordPharmacySearch, searchNearbyPharmacies } = require("./pharmacySearchService");

const recommendNearbyPharmacies = async ({
  telegramId,
  latitude,
  longitude,
  medicineQuery,
  medicineKnowledge = null,
} = {}) => {
  const knowledgeResult = medicineKnowledge || (medicineQuery
    ? await searchMedicineKnowledge({ query: medicineQuery })
    : null);
  const medicine = knowledgeResult?.medicine || null;
  const nearby = await searchNearbyPharmacies({ latitude, longitude });
  const pharmacyIds = nearby.pharmacies.map((pharmacy) => pharmacy._id);
  const availabilityByPharmacy = await findInventoryMatches({
    pharmacyIds,
    medicineQuery,
    medicineKnowledge: medicine,
  });
  const ranked = rankPharmacies({
    pharmacies: nearby.pharmacies,
    userLocation: { latitude, longitude },
    radiusKm: nearby.radiusKm,
    availabilityByPharmacy,
    medicineQuery,
    medicineKnowledge: medicine,
  });
  const inventoryMatchCount = Array.from(availabilityByPharmacy.values()).reduce(
    (sum, items) => sum + items.length,
    0
  );

  await recordPharmacySearch({
    telegramId: telegramId ? String(telegramId) : undefined,
    query: medicineQuery,
    normalizedMedicine: medicine?.genericName || medicine?.medicineName || medicineQuery,
    latitude,
    longitude,
    radiusKm: nearby.radiusKm,
    expandedRadius: nearby.expandedRadius,
    resultCount: ranked.length,
    inventoryMatchCount,
    topPharmacyName: ranked[0]?.name,
  });

  eventBus.emitSafe("pharmacy.ranking.completed", {
    telegramId,
    query: medicineQuery,
    resultCount: ranked.length,
    inventoryMatchCount,
    radiusKm: nearby.radiusKm,
    expandedRadius: nearby.expandedRadius,
  });

  return {
    ...nearby,
    medicine,
    medicineConfidence: knowledgeResult?.confidence || 0,
    ranked,
    inventoryMatchCount,
  };
};

module.exports = {
  recommendNearbyPharmacies,
};
