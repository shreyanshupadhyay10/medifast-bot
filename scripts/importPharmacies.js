require("dotenv").config();
const connectDB = require("../config/database");
const { importPharmaciesForCity } = require("../src/pharmacy/sources/sourceManager");
const eventBus = require("../src/events/eventBus");
const { registerAnalyticsListener } = require("../src/events/listeners/analyticsListener");

const run = async () => {
  await connectDB();
  registerAnalyticsListener(eventBus);

  const cityName = process.argv[2] || process.env.PHARMACY_IMPORT_CITY || "Jaipur";
  const summary = await importPharmaciesForCity({ cityName });

  console.log("Pharmacy import complete.");
  console.log(`City: ${summary.city}`);
  console.log(`Source: ${summary.source}`);
  console.log(`Raw records: ${summary.rawRecords}`);
  console.log(`Valid records: ${summary.validRecords}`);
  console.log(`Failed imports: ${summary.failedImports}`);
  console.log(`Coordinate issues: ${summary.coordinateIssues}`);
  console.log(`Duplicate removals: ${summary.duplicateRemovals}`);
  console.log(`Imported/updated: ${summary.importedPharmacyCount}`);
  console.log(`Seeded dummy pharmacies removed: ${summary.seededDummyRemoval?.removed || 0}`);
  console.log(`Coverage radius: ${summary.cityCoverage.radiusKm}km`);

  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
