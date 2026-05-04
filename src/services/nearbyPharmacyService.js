const Pharmacy = require("../models/Pharmacy");

const getNearbyPharmacyReadiness = async ({ latitude, longitude }) => {
  const activePharmacies = await Pharmacy.countDocuments({ isActive: true });
  const geoIndexedPharmacies = await Pharmacy.countDocuments({
    isActive: true,
    "geoLocation.coordinates.0": { $exists: true },
    "geoLocation.coordinates.1": { $exists: true },
  });

  return {
    latitude,
    longitude,
    activePharmacies,
    geoIndexedPharmacies,
    providersReady: ["Google Maps", "pharmacy inventory APIs", "live stock partners"],
    message: "Nearby pharmacy module ready for integration.",
  };
};

module.exports = {
  getNearbyPharmacyReadiness,
};
