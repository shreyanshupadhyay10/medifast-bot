const test = require("node:test");
const assert = require("node:assert/strict");
const { buildInventoryMatcher, scoreInventoryMatch, termsForMedicine } = require("../src/pharmacy/pharmacyAvailabilityService");
const { searchNearbyPharmacies } = require("../src/pharmacy/pharmacySearchService");

test("builds medicine terms from query and knowledge record", () => {
  const terms = termsForMedicine({
    medicineQuery: "Dolo near me",
    medicineKnowledge: {
      genericName: "Paracetamol",
      salts: ["Paracetamol"],
      brands: ["Dolo", "Calpol"],
    },
  });

  assert.equal(terms.includes("Paracetamol"), true);
  assert.equal(terms.includes("Dolo"), true);
});

test("scores pharmacy inventory matches", () => {
  const matcher = buildInventoryMatcher(["Paracetamol", "Dolo"]);

  assert.equal(matcher("Dolo 650 Tablet"), true);
  assert.equal(
    scoreInventoryMatch({
      pharmacy: { inventory: ["Dolo 650 Tablet"] },
      matches: [],
      medicineQuery: "Dolo",
    }),
    1
  );
  assert.equal(scoreInventoryMatch({ pharmacy: {}, matches: [], medicineQuery: "Dolo" }), 0);
});

test("nearby search rejects invalid coordinates without touching geo query", async () => {
  const result = await searchNearbyPharmacies({ latitude: 200, longitude: 75 });

  assert.deepEqual(result.pharmacies, []);
  assert.equal(result.geoReady, false);
});
