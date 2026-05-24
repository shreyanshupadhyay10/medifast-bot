const Pharmacy = require("../models/Pharmacy");
const { searchNearbyPharmacies } = require("../pharmacy/pharmacySearchService");

const getRadiusKm = () => {
  const radius = Number(process.env.NEARBY_RADIUS_KM || 5);
  const maxRadius = Number(process.env.NEARBY_MAX_RADIUS_KM || 10);
  return Math.min(Math.max(radius, 1), maxRadius);
};

const findNearbyPharmacies = async ({ latitude, longitude, radiusKm = getRadiusKm() }) => {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return { pharmacies: [], radiusKm, geoReady: false };
  }

  return searchNearbyPharmacies({ latitude, longitude, radiusKm });
};

const getNearbyPharmacyReadiness = async ({ latitude, longitude }) => {
  const activePharmacies = await Pharmacy.countDocuments({ isActive: true });
  const geoIndexedPharmacies = await Pharmacy.countDocuments({
    isActive: true,
    $or: [
      {
        "geoLocation.coordinates.0": { $exists: true },
        "geoLocation.coordinates.1": { $exists: true },
      },
      {
        "location.coordinates.0": { $exists: true },
        "location.coordinates.1": { $exists: true },
      },
    ],
  });

  const nearby = geoIndexedPharmacies > 0
    ? await findNearbyPharmacies({ latitude, longitude })
    : { pharmacies: [], radiusKm: getRadiusKm(), geoReady: false };

  return {
    latitude,
    longitude,
    activePharmacies,
    geoIndexedPharmacies,
    nearbyPharmacies: nearby.pharmacies,
    radiusKm: nearby.radiusKm,
    providersReady: ["Google Maps", "pharmacy inventory APIs", "live stock partners"],
    message: nearby.pharmacies.length
      ? `Found ${nearby.pharmacies.length} pharmacy option(s) within ${nearby.radiusKm} km.`
      : geoIndexedPharmacies > 0
        ? "No nearby pharmacies found for this location."
        : "Nearby pharmacy module ready for integration.",
  };
};

module.exports = {
  findNearbyPharmacies,
  getNearbyPharmacyReadiness,
};
