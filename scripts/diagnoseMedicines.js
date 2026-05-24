require("dotenv").config();
const connectDB = require("../config/database");
const { diagnoseMedicineKnowledge } = require("../src/medicine/diagnostics/knowledgeDiagnostics");

const run = async () => {
  await connectDB();
  const report = await diagnoseMedicineKnowledge();

  console.log("Medicine Knowledge Diagnostics");
  console.log(`Medicine records: ${report.medicineRecords}`);
  console.log(`Brands: ${report.totalBrands}`);
  console.log(`Aliases: ${report.totalAliases}`);
  console.log(`Salts: ${report.totalSalts}`);
  console.log(`Fuse index size: ${report.fuseIndexSize}`);
  console.log(`Duplicates: ${report.duplicateMedicines}`);
  console.log(`Missing medicineName: ${report.missingFields.medicineName}`);
  console.log(`Missing genericName: ${report.missingFields.genericName}`);
  console.log(`Missing knowledgeKey: ${report.missingFields.knowledgeKey}`);
  console.log(`Successful normalization: ${report.normalization.successfulNormalization}`);
  console.log(`Failed normalization: ${report.normalization.failedNormalization}`);
  console.log("Confidence distribution:");
  console.log(JSON.stringify(report.normalization.confidenceDistribution, null, 2));
  console.log("Top unknown medicines:");
  console.log(JSON.stringify(report.normalization.topUnknownMedicines, null, 2));
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
