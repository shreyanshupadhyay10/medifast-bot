require("dotenv").config();
const connectDB = require("../config/database");
const { diagnoseMemory } = require("../src/memory/memoryDiagnostics");
const { retrieveRelevantMemory } = require("../src/memory/semanticMemory");

const run = async () => {
  await connectDB();
  const report = await diagnoseMemory();
  const query = process.argv.slice(2).join(" ") || "medicine for papa";
  const retrieval = report.example
    ? await retrieveRelevantMemory({ telegramId: report.example.telegramId, query })
    : { facts: [] };

  console.log("Memory Diagnostics");
  console.log(`Conversation profiles: ${report.profiles}`);
  console.log(`Stored facts: ${report.storedFacts}`);
  console.log(`Fact types: ${JSON.stringify(report.factTypes, null, 2)}`);
  console.log(`Vector mode: ${report.vectorMode}`);
  console.log(`Memory vector count: ${report.vectorCount}`);
  if (report.vectorError) console.log(`Vector error: ${report.vectorError}`);
  console.log(`Storage path: ${report.storagePath || "remote Chroma server"}`);
  console.log(`Example memory: ${report.example ? JSON.stringify(report.example, null, 2) : "none"}`);
  console.log(`Retrieval for "${query}": ${JSON.stringify(retrieval.facts, null, 2)}`);
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
