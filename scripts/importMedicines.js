require("dotenv").config();
const connectDB = require("../config/database");
const { importMedicineSources } = require("../src/medicine/medicineImporter");

const run = async () => {
  await connectDB();
  const root = process.argv[2];
  const summary = await importMedicineSources({ root });

  console.log("Medicine knowledge import complete.");
  console.log(`Sources: ${summary.sourceCount}`);
  console.log(`Raw records: ${summary.rawRecords}`);
  console.log(`Valid records: ${summary.validRecords}`);
  console.log(`Failed records: ${summary.failedRecords}`);
  console.log(`Duplicate removals: ${summary.duplicateRemovals}`);
  console.log(`Imported/updated: ${summary.importedMedicineCount}`);
  console.log(`Fuse index records: ${summary.fuseIndexRecords}`);

  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
