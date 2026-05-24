const { formatDistance, getPharmacyCoordinates, haversineDistanceKm } = require("./pharmacyLocationService");
const { scoreInventoryMatch } = require("./pharmacyAvailabilityService");

const DEFAULT_WEIGHTS = {
  distanceWeight: 0.5,
  inventoryWeight: 0.3,
  confidenceWeight: 0.2,
};

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const distanceScoreFor = (distanceKm, radiusKm) => {
  if (!Number.isFinite(distanceKm)) return 0;
  if (!radiusKm || radiusKm <= 0) return 0;
  return clamp01(1 - distanceKm / radiusKm);
};

const rankPharmacies = ({
  pharmacies = [],
  userLocation,
  radiusKm = 5,
  availabilityByPharmacy = new Map(),
  medicineQuery,
  medicineKnowledge,
  weights = DEFAULT_WEIGHTS,
} = {}) =>
  pharmacies
    .map((pharmacy) => {
      const coordinates = getPharmacyCoordinates(pharmacy);
      const distanceKm = coordinates ? haversineDistanceKm(userLocation, coordinates) : null;
      const distanceScore = distanceScoreFor(distanceKm, radiusKm);
      const matches = availabilityByPharmacy.get(String(pharmacy._id)) || [];
      const inventoryScore = scoreInventoryMatch({ pharmacy, matches, medicineQuery, medicineKnowledge });
      const confidence = clamp01(pharmacy.confidence ?? 0.75);
      const score =
        distanceScore * weights.distanceWeight +
        inventoryScore * weights.inventoryWeight +
        confidence * weights.confidenceWeight;

      return {
        pharmacy,
        name: pharmacy.name,
        address: pharmacy.address,
        phone: pharmacy.phone || pharmacy.contact?.phone || null,
        distanceKm,
        distance: formatDistance(distanceKm),
        score: Number(score.toFixed(3)),
        inventoryConfidence: Number(inventoryScore.toFixed(3)),
        confidence,
        inventoryMatches: matches,
      };
    })
    .sort((a, b) => b.score - a.score);

module.exports = {
  DEFAULT_WEIGHTS,
  distanceScoreFor,
  rankPharmacies,
};
