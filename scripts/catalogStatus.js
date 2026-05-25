require("dotenv").config();
const connectDB = require("../config/database");
const { diagnoseCatalog } = require("../src/medicine/diagnostics/catalogDiagnostics");

const run = async () => {
  await connectDB();
  const report = await diagnoseCatalog();
  const progress = report.progress || {};

  console.log("Catalog Status");
  console.log(`Total records: ${report.totalMedicines}`);
  console.log(`Processed records: ${progress.processedRecords || 0}`);
  console.log(`Remaining records: ${report.remainingRecords}`);
  console.log(`Progress completion: ${report.progressCompletionPercent}%`);
  console.log(`Vectorized medicines: ${report.vectorizedMedicines}`);
  console.log(`Vectorized chunks: ${report.vectorizedChunks}`);
  console.log(`Vector coverage: ${report.coveragePercent}%`);
  console.log(`Batches completed: ${progress.batches || 0}`);
  console.log(`Last processed id: ${progress.lastId || "none"}`);
  console.log(`Complete: ${report.complete}`);
  console.log(`Progress file: ${report.progressPath}`);
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
