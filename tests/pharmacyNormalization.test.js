const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildAddress,
  coordinatesForOsmElement,
  normalizeOsmPharmacy,
} = require("../src/pharmacy/sources/datasetNormalizer");
const { validateDataset, validatePharmacyRecord } = require("../src/pharmacy/sources/datasetValidator");
const { identityFor, mergeDataset } = require("../src/pharmacy/sources/datasetMerger");

test("normalizes OSM pharmacy tags into Pharmacy-compatible records", () => {
  const record = normalizeOsmPharmacy(
    {
      type: "node",
      id: 123,
      lat: 26.91,
      lon: 75.78,
      tags: {
        name: "  Jaipur Medicos ",
        "addr:street": "MI Road",
        "addr:suburb": "C Scheme",
        phone: "0141-123456",
        opening_hours: "24/7",
      },
    },
    { cityName: "Jaipur", datasetVersion: "v1" }
  );

  assert.equal(record.name, "Jaipur Medicos");
  assert.equal(record.area, "C Scheme");
  assert.equal(record.city, "Jaipur");
  assert.deepEqual(record.location.coordinates, [75.78, 26.91]);
  assert.equal(record.is24x7, true);
  assert.equal(record.sourceMetadata.osmId, "123");
});

test("uses way center coordinates and validates coordinate issues", () => {
  assert.deepEqual(coordinatesForOsmElement({ center: { lat: "26.9", lon: "75.8" } }), {
    latitude: 26.9,
    longitude: 75.8,
  });

  const invalid = normalizeOsmPharmacy({ tags: { name: "No Coords" } }, { cityName: "Jaipur" });
  const result = validatePharmacyRecord(invalid);
  assert.equal(result.valid, false);
  assert.equal(result.errors.some((error) => /coordinates/i.test(error)), true);
});

test("deduplicates pharmacies by OSM id and keeps richer address", () => {
  const first = normalizeOsmPharmacy(
    { type: "node", id: 99, lat: 26.91, lon: 75.78, tags: { name: "Care Pharmacy", "addr:city": "Jaipur" } },
    { cityName: "Jaipur" }
  );
  const second = normalizeOsmPharmacy(
    {
      type: "node",
      id: 99,
      lat: 26.91,
      lon: 75.78,
      tags: { name: "Care Pharmacy", "addr:street": "Tonk Road", "addr:suburb": "Durgapura" },
    },
    { cityName: "Jaipur" }
  );

  const merged = mergeDataset([first, second]);
  assert.equal(merged.records.length, 1);
  assert.equal(merged.duplicateCount, 1);
  assert.match(merged.records[0].address, /Tonk Road|Durgapura/);
  assert.equal(identityFor(first), "OpenStreetMap:99");
});

test("builds fallback address and separates failed records", () => {
  assert.equal(buildAddress({}, "Jaipur"), "Jaipur");
  const result = validateDataset([
    normalizeOsmPharmacy({ type: "node", id: 1, lat: 26.91, lon: 75.78, tags: { name: "Valid" } }),
    normalizeOsmPharmacy({ type: "node", id: 2, tags: { name: "Invalid" } }),
  ]);

  assert.equal(result.valid.length, 1);
  assert.equal(result.failed.length, 1);
  assert.equal(result.coordinateIssues.length, 1);
});
