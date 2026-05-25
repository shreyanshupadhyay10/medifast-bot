require("dotenv").config();
const connectDB = require("../config/database");
const { cleanupMedicineDuplicates } = require("../src/medicine/maintenance/duplicateCleanup");

const run = async () => {
  await connectDB();
  const apply = process.argv.includes("--apply") || process.env.DUPLICATE_CLEANUP_APPLY === "true";
  const summary = await cleanupMedicineDuplicates({ dryRun: !apply });

  console.log("Medicine Duplicate Cleanup");
  console.log(`Mode: ${summary.dryRun ? "dry-run" : "apply"}`);
  console.log(`Duplicate groups: ${summary.duplicateGroups}`);
  console.log(`Merged groups: ${summary.mergedGroups}`);
  console.log(`Duplicate removals: ${summary.duplicateRemovals}`);
  if (summary.dryRun) console.log("Run with --apply to write changes.");
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
