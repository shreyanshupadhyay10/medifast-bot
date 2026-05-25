require("dotenv").config();
const mongoose = require("mongoose");
const { traceRuntime, formatRuntimeTrace } = require("../src/diagnostics/runtimeTrace");

const run = async () => {
  const query = process.argv.slice(2).join(" ") || "Dolo near me";
  await mongoose.connect(process.env.MONGODB_URI);
  const trace = await traceRuntime({
    query,
    from: {
      id: process.env.RUNTIME_TRACE_TELEGRAM_ID || "runtime",
      first_name: "Runtime",
    },
    includeInventory: true,
  });
  console.log(formatRuntimeTrace(trace, (value) => String(value || "").replace(/<[^>]+>/g, "")));
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(`Runtime trace failed: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
