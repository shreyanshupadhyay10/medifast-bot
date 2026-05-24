const test = require("node:test");
const assert = require("node:assert/strict");
const {
  formatDistance,
  getPharmacyCoordinates,
  haversineDistanceKm,
  normalizeCoordinates,
  toGeoPoint,
} = require("../src/pharmacy/pharmacyLocationService");

test("normalizes Telegram coordinates and creates GeoJSON point", () => {
  const normalized = normalizeCoordinates({ latitude: "26.9124", longitude: "75.7873" });

  assert.deepEqual(normalized, { latitude: 26.9124, longitude: 75.7873 });
  assert.deepEqual(toGeoPoint(normalized), {
    type: "Point",
    coordinates: [75.7873, 26.9124],
  });
  assert.equal(normalizeCoordinates({ latitude: 100, longitude: 75 }), null);
});

test("calculates and formats nearby distance", () => {
  const distance = haversineDistanceKm(
    { latitude: 26.9124, longitude: 75.7873 },
    { latitude: 26.915, longitude: 75.79 }
  );

  assert.equal(distance < 1, true);
  assert.match(formatDistance(distance), /m$/);
});

test("reads both new location and legacy geoLocation pharmacy fields", () => {
  assert.deepEqual(
    getPharmacyCoordinates({ location: { type: "Point", coordinates: [75.8, 26.9] } }),
    { latitude: 26.9, longitude: 75.8 }
  );
  assert.deepEqual(
    getPharmacyCoordinates({ geoLocation: { type: "Point", coordinates: [75.81, 26.91] } }),
    { latitude: 26.91, longitude: 75.81 }
  );
});
