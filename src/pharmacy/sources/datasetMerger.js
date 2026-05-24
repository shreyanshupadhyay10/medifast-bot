const { normalizeQuery } = require("../../services/intentEngine");

const locationKey = (record = {}) => {
  const coordinates = record.location?.coordinates || record.geoLocation?.coordinates || [];
  if (coordinates.length !== 2) return "";
  return coordinates.map((value) => Number(value).toFixed(4)).join(",");
};

const identityFor = (record = {}) => {
  const osmId = record.sourceMetadata?.osmId;
  if (osmId) return `${record.sourceMetadata?.source || "osm"}:${osmId}`;
  const phone = record.phone || record.contact?.phone;
  if (phone) return `phone:${phone.replace(/\D/g, "")}`;
  return normalizeQuery([record.name, record.area, locationKey(record)].filter(Boolean).join(" "));
};

const mergePharmacyRecord = (existing, incoming) => ({
  ...existing,
  ...incoming,
  name: existing.name || incoming.name,
  area: existing.area || incoming.area,
  address: existing.address?.length >= incoming.address?.length ? existing.address : incoming.address,
  phone: existing.phone || incoming.phone,
  contact: {
    ...(existing.contact || {}),
    ...(incoming.contact || {}),
    phone: existing.contact?.phone || incoming.contact?.phone || existing.phone || incoming.phone,
  },
  inventory: [...new Set([...(existing.inventory || []), ...(incoming.inventory || [])].filter(Boolean))],
  confidence: Math.max(existing.confidence || 0, incoming.confidence || 0),
  sourceMetadata: {
    ...(existing.sourceMetadata || {}),
    ...(incoming.sourceMetadata || {}),
    importedAt: new Date(),
  },
});

const mergeDataset = (records = []) => {
  const map = new Map();
  let duplicateCount = 0;

  records.forEach((record) => {
    const key = identityFor(record);
    if (!key) return;
    if (map.has(key)) {
      duplicateCount += 1;
      map.set(key, mergePharmacyRecord(map.get(key), record));
    } else {
      map.set(key, record);
    }
  });

  return {
    records: [...map.values()],
    duplicateCount,
  };
};

module.exports = {
  identityFor,
  locationKey,
  mergeDataset,
  mergePharmacyRecord,
};
