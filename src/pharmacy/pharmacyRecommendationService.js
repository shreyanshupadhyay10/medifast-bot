const { searchMedicineKnowledge } = require("../medicine/medicineKnowledgeService");
const eventBus = require("../events/eventBus");
const SearchHistory = require("../models/SearchHistory");
const PharmacySearchHistory = require("../models/PharmacySearchHistory");
const { findInventoryMatches } = require("./pharmacyAvailabilityService");
const { rankPharmacies } = require("./pharmacyRankingService");
const { recordPharmacySearch, searchNearbyPharmacies } = require("./pharmacySearchService");

const buildPharmacyIntelligenceMaps = async () => {
  const rows = await PharmacySearchHistory.aggregate([
    { $match: { topPharmacyName: { $exists: true, $nin: [null, ""] } } },
    {
      $group: {
        _id: "$topPharmacyName",
        searches: { $sum: 1 },
        avgResultCount: { $avg: "$resultCount" },
        avgConfidence: { $avg: "$confidenceQuality" },
        inventoryMatches: { $sum: "$inventoryMatchCount" },
      },
    },
    { $sort: { searches: -1 } },
    { $limit: 100 },
  ]);
  const maxSearches = Math.max(...rows.map((row) => row.searches), 1);
  const popularityByPharmacy = new Map();
  const successByPharmacy = new Map();
  rows.forEach((row) => {
    popularityByPharmacy.set(row._id, Math.min(1, row.searches / maxSearches));
    const success = (Number(row.avgConfidence || 0) + Math.min(Number(row.inventoryMatches || 0) / Math.max(row.searches, 1), 1)) / 2;
    successByPharmacy.set(row._id, Math.min(1, success));
  });
  return { popularityByPharmacy, successByPharmacy };
};

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
  const historicalDemand = medicineQuery
    ? await SearchHistory.countDocuments({
        $or: [
          { normalizedQuery: { $regex: medicineQuery, $options: "i" } },
          medicine?.genericName ? { normalizedQuery: { $regex: medicine.genericName, $options: "i" } } : null,
        ].filter(Boolean),
      })
    : 0;
  const nearby = await searchNearbyPharmacies({ latitude, longitude });
  const pharmacyIds = nearby.pharmacies.map((pharmacy) => pharmacy._id);
  const availabilityByPharmacy = await findInventoryMatches({
    pharmacyIds,
    medicineQuery,
    medicineKnowledge: medicine,
    historicalDemand,
  });
  const { popularityByPharmacy, successByPharmacy } = await buildPharmacyIntelligenceMaps();
  const ranked = rankPharmacies({
    pharmacies: nearby.pharmacies,
    userLocation: { latitude, longitude },
    radiusKm: nearby.radiusKm,
    availabilityByPharmacy,
    popularityByPharmacy,
    successByPharmacy,
    medicineQuery,
    medicineKnowledge: medicine,
  });
  const inventoryMatchCount = Array.from(availabilityByPharmacy.values()).reduce(
    (sum, items) => sum + items.length,
    0
  );
  const confidenceQuality = ranked.length
    ? ranked.reduce((sum, item) => sum + Number(item.inventoryConfidence || 0), 0) / ranked.length
    : 0;

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
    historicalDemand,
    confidenceQuality,
    medicineConfidence: knowledgeResult?.confidence || 0,
    topPharmacyName: ranked[0]?.name,
  });

  eventBus.emitSafe("pharmacy.ranking.completed", {
    telegramId,
    query: medicineQuery,
    resultCount: ranked.length,
    inventoryMatchCount,
    estimatedConfidenceUsed: inventoryMatchCount === 0 && ranked.some((item) => item.inventoryConfidence > 0),
    confidenceQuality,
    osmHydrated: nearby.osmHydrated,
    radiusKm: nearby.radiusKm,
    expandedRadius: nearby.expandedRadius,
  });

  return {
    ...nearby,
    medicine,
    medicineConfidence: knowledgeResult?.confidence || 0,
    ranked,
    inventoryMatchCount,
    historicalDemand,
    confidenceQuality,
  };
};

module.exports = {
  recommendNearbyPharmacies,
};
