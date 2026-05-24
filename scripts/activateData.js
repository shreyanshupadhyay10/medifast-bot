require("dotenv").config();
const connectDB = require("../config/database");
const { enrichMedicineKnowledge } = require("../src/medicine/enrichment/medicineEnrichmentService");
const { importPharmaciesForCity } = require("../src/pharmacy/sources/sourceManager");

const run = async () => {
  await connectDB();
  const cityName = process.argv[2] || process.env.PHARMACY_IMPORT_CITY || "Jaipur";
  const medicine = await enrichMedicineKnowledge();
  const pharmacy = await importPharmaciesForCity({ cityName });

  console.log("MediFast real data activation complete.");
  console.log(`Medicine records scanned: ${medicine.scanned}`);
  console.log(`Medicine aliases added: ${medicine.aliasesAdded}`);
  console.log(`Medicine records updated: ${medicine.updated}`);
  console.log(`Medicine Fuse index size: ${medicine.fuseIndexSize}`);
  console.log(`Pharmacy city: ${pharmacy.city}`);
  console.log(`Real pharmacy records imported/updated: ${pharmacy.importedPharmacyCount}`);
  console.log(`Seeded dummy pharmacies removed: ${pharmacy.seededDummyRemoval?.removed || 0}`);
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
