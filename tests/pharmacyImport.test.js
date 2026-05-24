const test = require("node:test");
const assert = require("node:assert/strict");
const { importPharmaciesForCity } = require("../src/pharmacy/sources/sourceManager");

test("imports Jaipur OSM pharmacy data through dry-run pipeline", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      osm3s: { timestamp_osm_base: "test-dataset" },
      elements: [
        {
          type: "node",
          id: 1,
          lat: 26.912,
          lon: 75.787,
          tags: { name: "Alpha Pharmacy", "addr:suburb": "Mansarovar" },
        },
        {
          type: "node",
          id: 1,
          lat: 26.912,
          lon: 75.787,
          tags: { name: "Alpha Pharmacy", "addr:street": "Main Road", "addr:suburb": "Mansarovar" },
        },
        {
          type: "node",
          id: 2,
          tags: { name: "Broken Pharmacy" },
        },
      ],
    }),
  });

  const summary = await importPharmaciesForCity({ cityName: "Jaipur", fetchImpl, dryRun: true });

  assert.equal(summary.city, "Jaipur");
  assert.equal(summary.rawRecords, 3);
  assert.equal(summary.validRecords, 2);
  assert.equal(summary.failedImports, 1);
  assert.equal(summary.coordinateIssues, 1);
  assert.equal(summary.duplicateRemovals, 1);
  assert.equal(summary.records.length, 1);
  assert.equal(summary.importedPharmacyCount, 0);
  assert.equal(summary.cityCoverage.radiusKm, 25);
});
