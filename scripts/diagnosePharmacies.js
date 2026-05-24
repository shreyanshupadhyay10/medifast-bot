require("dotenv").config();
const connectDB = require("../config/database");
const { diagnosePharmacies } = require("../src/pharmacy/diagnostics/pharmacyDiagnostics");

const run = async () => {
  await connectDB();
  const report = await diagnosePharmacies();

  console.log("Pharmacy Diagnostics");
  console.log(`Pharmacy records: ${report.pharmacyCount}`);
  console.log(`Jaipur records: ${report.jaipurCount}`);
  console.log(`Geo-ready records: ${report.coordinatesCount}`);
  console.log(`OpenStreetMap records: ${report.openStreetMapCount}`);
  console.log(`Duplicates: ${report.duplicatePharmacies}`);
  console.log(`Seeded dummy entries: ${report.seededDummyEntries}`);
  console.log(`Real data active: ${report.realDataActive}`);
  console.log(`location 2dsphere index: ${report.geoIndexExists.location}`);
  console.log(`geoLocation 2dsphere index: ${report.geoIndexExists.geoLocation}`);
  console.log("Duplicate samples:");
  console.log(JSON.stringify(report.duplicateSamples, null, 2));
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
