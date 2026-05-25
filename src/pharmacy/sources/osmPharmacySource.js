const DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OSM_TIMEOUT_MS = () => Number(process.env.OSM_TIMEOUT_MS || 8000);
const OSM_RETRIES = () => Number(process.env.OSM_RETRIES || 1);

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

const postOverpass = async ({ fetchImpl, overpassUrl, query }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OSM_TIMEOUT_MS());
  try {
    return await fetchImpl(overpassUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "user-agent": "MediFastAI/1.0 pharmacy-import",
      },
      body: new URLSearchParams({ data: query }),
    });
  } finally {
    clearTimeout(timeout);
  }
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

  let response;
  let lastError;
  for (let attempt = 0; attempt <= OSM_RETRIES(); attempt += 1) {
    try {
      response = await postOverpass({ fetchImpl, overpassUrl, query });
      if (response.ok) break;
      lastError = new Error(`OpenStreetMap Overpass request failed with status ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  if (!response?.ok) {
    throw lastError || new Error("OpenStreetMap Overpass request failed");
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
  postOverpass,
};
