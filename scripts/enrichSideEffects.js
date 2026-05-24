require("dotenv").config();
const connectDB = require("../config/database");
const { enrichSideEffectsFromFile } = require("../src/medicine/enrichment/sideEffectsEnricher");

const run = async () => {
  await connectDB();
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error("Usage: npm run enrich-side-effects -- <path-to-side-effects.csv>");
  }

  const summary = await enrichSideEffectsFromFile({ filePath });

  console.log("Side effects enrichment complete.");
  console.log(`Source: ${summary.sourceFile}`);
  console.log(`Detected field map: ${JSON.stringify(summary.fieldMap)}`);
  console.log(`Raw records: ${summary.rawRecords}`);
  console.log(`Valid records: ${summary.validRecords}`);
  console.log(`Failed records: ${summary.failedRecords}`);
  console.log(`Matched records: ${summary.matchedRecords}`);
  console.log(`Unmatched records: ${summary.unmatchedRecords}`);
  console.log(`Match rate: ${summary.matchRate}`);
  console.log(`Match methods: ${JSON.stringify(summary.matchMethods)}`);
  console.log(`Confidence distribution: ${JSON.stringify(summary.confidenceDistribution)}`);
  console.log(`Side effects added/updated on medicines: ${summary.sideEffectsAdded}`);
  console.log(`Relationship growth estimate: ${summary.relationshipGrowth}`);
  console.log(`Average confidence: ${summary.averageConfidence}`);
  console.log(`Fuse index records: ${summary.fuseIndexRecords}`);

  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
