require("dotenv").config();
const connectDB = require("../config/database");
const { diagnoseCatalog } = require("../src/medicine/diagnostics/catalogDiagnostics");

const run = async () => {
  await connectDB();
  const report = await diagnoseCatalog();

  console.log("Medicine Catalog Activation Diagnostics");
  console.log(`Total medicine records: ${report.totalMedicines}`);
  console.log(`Distinct medicine keys: ${report.distinctMedicines}`);
  console.log(`Vector mode: ${report.vectorMode}`);
  console.log(`Storage path: ${report.storagePath || "remote Chroma server"}`);
  console.log(`Vector available: ${report.vectorAvailable}`);
  if (report.vectorError) console.log(`Vector error: ${report.vectorError}`);
  console.log(`Vectorized medicines: ${report.vectorizedMedicines}`);
  console.log(`Vectorized chunks: ${report.vectorizedChunks}`);
  console.log(`Identity chunks: ${report.identityChunks}`);
  console.log(`Coverage: ${report.coveragePercent}%`);
  console.log(`Ingestion completion: ${report.progressCompletionPercent}%`);
  console.log(`Remaining records: ${report.remainingRecords}`);
  console.log(`Complete: ${report.complete}`);
  console.log(`Duplicate groups: ${report.duplicates.duplicateGroups}`);
  console.log(`Duplicate records: ${report.duplicates.duplicateRecords}`);
  console.log(`Progress file: ${report.progressPath}`);
  console.log(`Progress: ${JSON.stringify(report.progress || {}, null, 2)}`);
  console.log("Top unknown medicine queries:");
  console.log(JSON.stringify(report.topUnknownMedicines, null, 2));
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
