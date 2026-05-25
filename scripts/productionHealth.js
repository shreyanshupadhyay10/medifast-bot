require("dotenv").config();
const connectDB = require("../config/database");
const { diagnoseProductionHealth } = require("../src/diagnostics/productionHealth");

const run = async () => {
  await connectDB();
  const report = await diagnoseProductionHealth();

  console.log("MediFast Production Health");
  console.log("Status:");
  console.log(JSON.stringify(report.status, null, 2));
  console.log("\nCatalog:");
  console.log(JSON.stringify({
    totalMedicines: report.catalog.totalMedicines,
    vectorizedMedicines: report.catalog.vectorizedMedicines,
    vectorizedChunks: report.catalog.vectorizedChunks,
    coveragePercent: report.catalog.coveragePercent,
    progressCompletionPercent: report.catalog.progressCompletionPercent,
    remainingRecords: report.catalog.remainingRecords,
    duplicates: report.catalog.duplicates,
  }, null, 2));
  console.log("\nMemory:");
  console.log(JSON.stringify({
    profiles: report.memory.profiles,
    storedFacts: report.memory.storedFacts,
    factTypes: report.memory.factTypes,
    vectorCount: report.memory.vectorCount,
  }, null, 2));
  console.log("\nRAG:");
  console.log(JSON.stringify({
    vectorMode: report.rag.vectorMode,
    vectorCount: report.rag.vectorCount,
    retrievalHits: report.rag.retrievalHits,
    topConfidence: report.rag.topConfidence,
    quality: report.rag.quality,
  }, null, 2));
  console.log("\nLLM:");
  console.log(JSON.stringify(report.llm, null, 2));
  console.log("\nPharmacy:");
  console.log(JSON.stringify(report.pharmacy, null, 2));
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
