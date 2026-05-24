const DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const buildOverpassQuery = ({ lat, lng, radiusKm }) => {
  const radiusMeters = Math.round(Number(radiusKm || 25) * 1000);
  return `
    [out:json][timeout:30];
    (
      node["amenity"="pharmacy"](around:${radiusMeters},${lat},${lng});
      way["amenity"="pharmacy"](around:${radiusMeters},${lat},${lng});
      relation["amenity"="pharmacy"](around:${radiusMeters},${lat},${lng});
      node["healthcare"="pharmacy"](around:${radiusMeters},${lat},${lng});
      way["healthcare"="pharmacy"](around:${radiusMeters},${lat},${lng});
      relation["healthcare"="pharmacy"](around:${radiusMeters},${lat},${lng});
    );
    out center tags;
  `;
};

const fetchOsmPharmacies = async ({ city, fetchImpl = global.fetch, overpassUrl = process.env.OVERPASS_URL || DEFAULT_OVERPASS_URL }) => {
  if (!fetchImpl) {
    throw new Error("fetch is not available. Use Node.js 18+ or pass fetchImpl.");
  }

  const query = buildOverpassQuery({
    lat: city.lat,
    lng: city.lng,
    radiusKm: city.radiusKm,
  });

  const response = await fetchImpl(overpassUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      "user-agent": "MediFastAI/1.0 pharmacy-import",
    },
    body: new URLSearchParams({ data: query }),
  });

  if (!response.ok) {
    throw new Error(`OpenStreetMap Overpass request failed with status ${response.status}`);
  }

  const body = await response.json();
  return {
    sourceName: "OpenStreetMap",
    datasetVersion: body.osm3s?.timestamp_osm_base || new Date().toISOString().slice(0, 10),
    records: body.elements || [],
  };
};

module.exports = {
  DEFAULT_OVERPASS_URL,
  buildOverpassQuery,
  fetchOsmPharmacies,
};
