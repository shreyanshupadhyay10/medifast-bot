require("dotenv").config();
const connectDB = require("../config/database");
const { enrichMedicineKnowledge } = require("../src/medicine/enrichment/medicineEnrichmentService");

const run = async () => {
  await connectDB();
  const limit = process.argv[2] ? Number(process.argv[2]) : undefined;
  const summary = await enrichMedicineKnowledge({ limit });

  console.log("Medicine knowledge enrichment complete.");
  console.log(`Scanned: ${summary.scanned}`);
  console.log(`Valid: ${summary.valid}`);
  console.log(`Invalid: ${summary.invalid}`);
  console.log(`Aliases added: ${summary.aliasesAdded}`);
  console.log(`Missing relationships: ${summary.missingRelationships}`);
  console.log(`Duplicate keys: ${summary.duplicateKeys}`);
  console.log(`Updated: ${summary.updated}`);
  console.log(`Fuse index size: ${summary.fuseIndexSize}`);
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
