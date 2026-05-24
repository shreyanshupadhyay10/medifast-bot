const test = require("node:test");
const assert = require("node:assert/strict");
const { distanceScoreFor, rankPharmacies } = require("../src/pharmacy/pharmacyRankingService");

test("scores distance from user location", () => {
  assert.equal(distanceScoreFor(0, 5), 1);
  assert.equal(distanceScoreFor(2.5, 5), 0.5);
  assert.equal(distanceScoreFor(10, 5), 0);
});

test("ranks pharmacies by distance, inventory, and confidence", () => {
  const userLocation = { latitude: 26.9124, longitude: 75.7873 };
  const pharmacies = [
    {
      _id: "far",
      name: "Far Pharmacy",
      address: "Far Road",
      location: { type: "Point", coordinates: [75.86, 26.96] },
      inventory: ["Dolo"],
      confidence: 0.9,
    },
    {
      _id: "near",
      name: "Near Pharmacy",
      address: "Near Road",
      location: { type: "Point", coordinates: [75.788, 26.913] },
      inventory: ["Dolo 650"],
      confidence: 0.8,
    },
  ];

  const ranked = rankPharmacies({
    pharmacies,
    userLocation,
    radiusKm: 10,
    medicineQuery: "Dolo",
  });

  assert.equal(ranked[0].name, "Near Pharmacy");
  assert.equal(ranked[0].inventoryConfidence, 1);
  assert.equal(ranked[0].score > ranked[1].score, true);
});
