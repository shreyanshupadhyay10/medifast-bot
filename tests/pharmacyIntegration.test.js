const test = require("node:test");
const assert = require("node:assert/strict");
const Pharmacy = require("../src/models/Pharmacy");
const { removeSeededDummyPharmacies } = require("../src/pharmacy/sources/sourceManager");

test("removes known seeded dummy pharmacies when real geo data exists", async () => {
  const originals = {
    countDocuments: Pharmacy.countDocuments,
    deleteMany: Pharmacy.deleteMany,
  };

  Pharmacy.countDocuments = async () => 38;
  Pharmacy.deleteMany = async (query) => {
    assert.equal(query.source, "manual");
    assert.equal(query.name.$in.includes("Sharma Medical Store"), true);
    return { deletedCount: 8 };
  };

  try {
    const result = await removeSeededDummyPharmacies({ cityName: "Jaipur" });
    assert.equal(result.realCount, 38);
    assert.equal(result.removed, 8);
  } finally {
    Pharmacy.countDocuments = originals.countDocuments;
    Pharmacy.deleteMany = originals.deleteMany;
  }
});
