const { formatDistance, getPharmacyCoordinates, haversineDistanceKm } = require("./pharmacyLocationService");
const { scoreInventoryMatch } = require("./pharmacyAvailabilityService");

const DEFAULT_WEIGHTS = {
  distanceWeight: 0.42,
  inventoryWeight: 0.3,
  confidenceWeight: 0.16,
  popularityWeight: 0.07,
  successWeight: 0.05,
};

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const distanceScoreFor = (distanceKm, radiusKm) => {
  if (!Number.isFinite(distanceKm)) return 0;
  if (!radiusKm || radiusKm <= 0) return 0;
  return clamp01(1 - distanceKm / radiusKm);
};

const openStatusFor = (pharmacy = {}, now = new Date()) => {
  if (pharmacy.is24x7) return { label: "Open 24x7", score: 1 };
  const hours = String(pharmacy.openingHours || "").trim();
  if (!hours || /not available|unknown/i.test(hours)) return { label: "Hours unavailable", score: 0.55 };
  if (/24\/7|24x7|24 hours/i.test(hours)) return { label: "Open 24x7", score: 1 };

  const match = hours.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return { label: hours, score: 0.7 };

  const toMinutes = (hour, minute, meridiem, fallbackMeridiem) => {
    let h = Number(hour);
    const m = Number(minute || 0);
    const marker = String(meridiem || fallbackMeridiem || "").toUpperCase();
    if (marker === "PM" && h < 12) h += 12;
    if (marker === "AM" && h === 12) h = 0;
    return h * 60 + m;
  };

  const start = toMinutes(match[1], match[2], match[3], match[6]);
  const end = toMinutes(match[4], match[5], match[6], match[3]);
  const current = now.getHours() * 60 + now.getMinutes();
  const open = start <= end ? current >= start && current <= end : current >= start || current <= end;
  return { label: open ? "Likely open now" : "May be closed now", score: open ? 0.95 : 0.35 };
};

const rankPharmacies = ({
  pharmacies = [],
  userLocation,
  radiusKm = 5,
  availabilityByPharmacy = new Map(),
  popularityByPharmacy = new Map(),
  successByPharmacy = new Map(),
  medicineQuery,
  medicineKnowledge,
  historicalDemand = 0,
  weights = DEFAULT_WEIGHTS,
} = {}) =>
  pharmacies
    .map((pharmacy) => {
      const coordinates = getPharmacyCoordinates(pharmacy);
      const distanceKm = coordinates ? haversineDistanceKm(userLocation, coordinates) : null;
      const distanceScore = distanceScoreFor(distanceKm, radiusKm);
      const matches = availabilityByPharmacy.get(String(pharmacy._id)) || [];
      const inventoryScore = scoreInventoryMatch({ pharmacy, matches, medicineQuery, medicineKnowledge, historicalDemand });
      const confidence = clamp01(pharmacy.confidence ?? 0.75);
      const popularityScore = clamp01(popularityByPharmacy.get(pharmacy.name) ?? pharmacy.popularityScore ?? 0);
      const searchSuccessScore = clamp01(successByPharmacy.get(pharmacy.name) ?? pharmacy.searchSuccessScore ?? 0);
      const openStatus = openStatusFor(pharmacy);
      const score =
        distanceScore * weights.distanceWeight +
        inventoryScore * weights.inventoryWeight +
        confidence * weights.confidenceWeight +
        popularityScore * weights.popularityWeight +
        searchSuccessScore * weights.successWeight;

      return {
        pharmacy,
        name: pharmacy.name,
        address: pharmacy.address,
        phone: pharmacy.phone || pharmacy.contact?.phone || null,
        source: pharmacy.source || pharmacy.sourceMetadata?.source || "unknown",
        openingHours: pharmacy.openingHours,
        openStatus: openStatus.label,
        coordinates,
        directionsUrl: coordinates
          ? `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`
          : null,
        distanceKm,
        distance: formatDistance(distanceKm),
        score: Number(score.toFixed(3)),
        inventoryConfidence: Number(inventoryScore.toFixed(3)),
        medicineConfidence: Number((medicineKnowledge?.confidence || 0).toFixed?.(3) || medicineKnowledge?.confidence || 0),
        popularityScore: Number(popularityScore.toFixed(3)),
        searchSuccessScore: Number(searchSuccessScore.toFixed(3)),
        confidence,
        inventoryMatches: matches,
      };
    })
    .sort((a, b) => b.score - a.score);

module.exports = {
  DEFAULT_WEIGHTS,
  distanceScoreFor,
  openStatusFor,
  rankPharmacies,
};
