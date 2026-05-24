require("dotenv").config();
const connectDB = require("../config/database");
const { diagnoseRag } = require("../src/rag/ragDiagnostics");

const run = async () => {
  await connectDB();
  const query = process.argv.slice(2).join(" ") || "fever medicine safety";
  const report = await diagnoseRag({ query });

  console.log("RAG Diagnostics");
  console.log(`Knowledge files: ${report.knowledgeFiles}`);
  console.log(`Loaded documents: ${report.loadedDocuments}`);
  console.log(`Chunks: ${report.chunkCount}`);
  console.log(`Chroma available: ${report.chromaAvailable}`);
  console.log(`Vector count: ${report.vectorCount}`);
  if (report.vectorError) console.log(`Vector error: ${report.vectorError}`);
  console.log(`Retrieval hits: ${report.retrievalHits}`);
  console.log(`Top confidence: ${report.topConfidence}`);
  console.log(`Low confidence: ${report.retrievalLowConfidence}`);
  console.log(`Latency ms: ${report.retrievalLatencyMs}`);
  console.log("Sources:");
  console.log(JSON.stringify(report.retrievedSources, null, 2));
  console.log("Quality:");
  console.log(JSON.stringify(report.quality, null, 2));
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
