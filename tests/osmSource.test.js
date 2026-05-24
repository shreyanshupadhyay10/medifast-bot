const test = require("node:test");
const assert = require("node:assert/strict");
const { buildOverpassQuery, fetchOsmPharmacies } = require("../src/pharmacy/sources/osmPharmacySource");

test("builds Overpass query for pharmacies around a city", () => {
  const query = buildOverpassQuery({ lat: 26.9124, lng: 75.7873, radiusKm: 25 });

  assert.match(query, /amenity"="pharmacy/);
  assert.match(query, /healthcare"="pharmacy/);
  assert.match(query, /around:25000,26.9124,75.7873/);
});

test("fetches OSM pharmacy elements without assuming live network in tests", async () => {
  const fetchImpl = async (_url, options) => {
    assert.equal(options.method, "POST");
    assert.match(String(options.body), /amenity/);
    return {
      ok: true,
      json: async () => ({
        osm3s: { timestamp_osm_base: "2026-05-24T00:00:00Z" },
        elements: [{ type: "node", id: 1, lat: 26.91, lon: 75.78, tags: { name: "Test Pharmacy" } }],
      }),
    };
  };

  const result = await fetchOsmPharmacies({
    city: { lat: 26.9124, lng: 75.7873, radiusKm: 25 },
    fetchImpl,
    overpassUrl: "https://example.test/overpass",
  });

  assert.equal(result.sourceName, "OpenStreetMap");
  assert.equal(result.records.length, 1);
  assert.equal(result.datasetVersion, "2026-05-24T00:00:00Z");
});
