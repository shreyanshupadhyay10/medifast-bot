const Pharmacy = require("../../models/Pharmacy");

const hasGeoIndex = async (fieldName) => {
  const indexes = await Pharmacy.collection.indexes();
  return indexes.some((index) => index.key?.[fieldName] === "2dsphere");
};

const normalize = (value = "") => String(value).toLowerCase().replace(/\s+/g, " ").trim();

const coordinateKey = (pharmacy = {}) => {
  const coordinates = pharmacy.location?.coordinates || pharmacy.geoLocation?.coordinates || [];
  if (coordinates.length !== 2) return "";
  return coordinates.map((value) => Number(value).toFixed(4)).join(",");
};

const duplicateGroups = async () => {
  const pharmacies = await Pharmacy.find()
    .select("name city area phone contact sourceMetadata.osmId location.coordinates geoLocation.coordinates")
    .lean();
  const groups = new Map();

  pharmacies.forEach((pharmacy) => {
    const osmId = pharmacy.sourceMetadata?.osmId;
    const phone = pharmacy.phone || pharmacy.contact?.phone;
    const identity = osmId
      ? `osm:${osmId}`
      : phone
        ? `phone:${String(phone).replace(/\D/g, "")}`
        : [pharmacy.name, pharmacy.city, pharmacy.area, coordinateKey(pharmacy)].map(normalize).join("|");
    if (!identity || identity === "|||") return;
    groups.set(identity, (groups.get(identity) || 0) + 1);
  });

  return Array.from(groups.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ _id: name, count }));
};

const diagnosePharmacies = async () => {
  const [
    pharmacyCount,
    jaipurCount,
    coordinatesCount,
    osmCount,
    seededDummyEntries,
    duplicates,
    locationIndexExists,
    geoLocationIndexExists,
  ] = await Promise.all([
    Pharmacy.countDocuments(),
    Pharmacy.countDocuments({ city: { $regex: /^jaipur$/i } }),
    Pharmacy.countDocuments({
      $or: [
        { "location.coordinates.0": { $exists: true }, "location.coordinates.1": { $exists: true } },
        { "geoLocation.coordinates.0": { $exists: true }, "geoLocation.coordinates.1": { $exists: true } },
      ],
    }),
    Pharmacy.countDocuments({ source: "OpenStreetMap" }),
    Pharmacy.countDocuments({
      $or: [{ source: "manual" }, { source: { $exists: false } }],
      "sourceMetadata.osmId": { $exists: false },
    }),
    duplicateGroups(),
    hasGeoIndex("location"),
    hasGeoIndex("geoLocation"),
  ]);

  return {
    pharmacyCount,
    jaipurCount,
    coordinatesCount,
    openStreetMapCount: osmCount,
    duplicatePharmacies: duplicates.reduce((sum, item) => sum + item.count - 1, 0),
    duplicateSamples: duplicates.map((item) => ({ name: item._id, count: item.count })),
    geoIndexExists: {
      location: locationIndexExists,
      geoLocation: geoLocationIndexExists,
    },
    seededDummyEntries,
    realDataActive: osmCount > 0,
  };
};

module.exports = {
  diagnosePharmacies,
};
