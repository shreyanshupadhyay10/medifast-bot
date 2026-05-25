require("dotenv").config();
const connectDB = require("../config/database");
const AnalyticsEvent = require("../src/models/AnalyticsEvent");
const { createProvider } = require("../src/providers");

const run = async () => {
  await connectDB();
  const [orchestrationCount, groqUsage, latest] = await Promise.all([
    AnalyticsEvent.countDocuments({ eventType: "orchestration.completed" }),
    AnalyticsEvent.countDocuments({ eventType: "llm.groq.used" }),
    AnalyticsEvent.findOne({ eventType: "orchestration.completed" }).sort({ createdAt: -1 }).lean(),
  ]);

  console.log("LLM Diagnostics");
  console.log(`LLM provider: ${process.env.LLM_PROVIDER || process.env.AI_PROVIDER || "deterministic"}`);
  console.log(`LLM synthesis enabled: ${process.env.ENABLE_LLM_SYNTHESIS === "true"}`);
  console.log(`Groq key configured: ${Boolean(process.env.GROQ_API_KEY)}`);
  console.log(`Groq model: ${process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct"}`);
  console.log(`Groq timeout ms: ${process.env.GROQ_TIMEOUT_MS || 4500}`);
  console.log(`Orchestration events: ${orchestrationCount}`);
  console.log(`Groq usage events: ${groqUsage}`);
  console.log(`Latest orchestration: ${latest ? JSON.stringify(latest.metadata, null, 2) : "none"}`);

  if (process.env.DIAGNOSE_LLM_LIVE === "true") {
    const provider = createProvider();
    const result = await provider.generate({
      prompt: "Summarize evidence availability in one short line.",
      fallback: "No live LLM response.",
      evidence: { confidenceScores: { medicine: 0.9 }, medicineContext: { medicine: { genericName: "Paracetamol" } } },
    });
    console.log(`Live provider result: ${JSON.stringify({ ok: result.ok, provider: result.provider, model: result.model, latencyMs: result.latencyMs, textLength: result.text?.length || 0, error: result.error || null }, null, 2)}`);
  }
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
