const test = require("node:test");
const assert = require("node:assert/strict");
const Pharmacy = require("../src/models/Pharmacy");
const { diagnosePharmacies } = require("../src/pharmacy/diagnostics/pharmacyDiagnostics");

test("reports pharmacy diagnostics including geo indexes and real data state", async () => {
  const originals = {
    countDocuments: Pharmacy.countDocuments,
    find: Pharmacy.find,
    collection: Pharmacy.collection,
  };

  const counts = [50, 44, 38, 38, 8];
  Pharmacy.countDocuments = async () => counts.shift() ?? 0;
  Pharmacy.find = () => ({
    select: () => ({
      lean: async () => [
        { name: "Care Pharmacy", city: "Jaipur", area: "MI Road", sourceMetadata: { osmId: "1" } },
        { name: "Care Pharmacy", city: "Jaipur", area: "MI Road", sourceMetadata: { osmId: "1" } },
      ],
    }),
  });
  Pharmacy.collection = {
    indexes: async () => [
      { key: { location: "2dsphere" } },
      { key: { geoLocation: "2dsphere" } },
    ],
  };

  try {
    const report = await diagnosePharmacies();
    assert.equal(report.pharmacyCount, 50);
    assert.equal(report.jaipurCount, 44);
    assert.equal(report.coordinatesCount, 38);
    assert.equal(report.openStreetMapCount, 38);
    assert.equal(report.seededDummyEntries, 8);
    assert.equal(report.realDataActive, true);
    assert.equal(report.geoIndexExists.location, true);
    assert.equal(report.geoIndexExists.geoLocation, true);
    assert.equal(report.duplicatePharmacies, 1);
  } finally {
    Pharmacy.countDocuments = originals.countDocuments;
    Pharmacy.find = originals.find;
    Pharmacy.collection = originals.collection;
  }
});
