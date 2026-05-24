const { toGeoPoint } = require("../pharmacyLocationService");

const clean = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
};

const first = (...values) => values.map(clean).find(Boolean) || null;

const buildAddress = (tags = {}, fallbackCity = "Jaipur") => {
  const house = first(tags["addr:housenumber"], tags["addr:unit"]);
  const street = first(tags["addr:street"], tags["addr:place"]);
  const suburb = first(tags["addr:suburb"], tags["addr:neighbourhood"], tags["addr:locality"]);
  const city = first(tags["addr:city"], fallbackCity);
  const postcode = first(tags["addr:postcode"]);
  return [house, street, suburb, city, postcode].filter(Boolean).join(", ");
};

const coordinatesForOsmElement = (element = {}) => {
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (lat === undefined || lng === undefined) return null;
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
};

const normalizeOsmPharmacy = (element = {}, { cityName = "Jaipur", sourceName = "OpenStreetMap", datasetVersion = "unknown" } = {}) => {
  const tags = element.tags || {};
  const coordinates = coordinatesForOsmElement(element);
  const name = first(tags.name, tags.brand, tags.operator, "Unnamed Pharmacy");
  const area = first(tags["addr:suburb"], tags["addr:neighbourhood"], tags["addr:locality"], tags["addr:city"], cityName);
  const address = first(buildAddress(tags, cityName), `${area}, ${cityName}`);
  const phone = first(tags.phone, tags["contact:phone"], tags.mobile, tags["contact:mobile"]);
  const openingHours = first(tags.opening_hours, tags["opening_hours:covid19"]);
  const is24x7 = openingHours ? /24\/7|24x7|24 hours/i.test(openingHours) : false;

  return {
    name,
    area,
    address,
    phone,
    contact: {
      phone,
      whatsapp: first(tags["contact:whatsapp"], tags.whatsapp),
    },
    location: coordinates ? toGeoPoint(coordinates) : undefined,
    geoLocation: coordinates ? toGeoPoint(coordinates) : undefined,
    city: cityName,
    inventory: [],
    confidence: name === "Unnamed Pharmacy" ? 0.55 : 0.78,
    source: sourceName,
    sourceMetadata: {
      source: sourceName,
      trustLevel: "medium",
      importedAt: new Date(),
      datasetVersion,
      osmType: element.type || null,
      osmId: element.id ? String(element.id) : null,
    },
    openingHours: openingHours || "Hours not available",
    is24x7,
    isActive: true,
    lastVerified: new Date(),
  };
};

module.exports = {
  buildAddress,
  clean,
  coordinatesForOsmElement,
  normalizeOsmPharmacy,
};
