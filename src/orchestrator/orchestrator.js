const { createProvider } = require("../providers");
const { planWorkflow } = require("./workflowPlanner");
const { executeWorkflowTools } = require("./toolExecutor");
const { mergeWorkflowResponse } = require("./responseMerger");
const { collectEvidence, estimateEvidenceSize } = require("./evidenceCollector");
const eventBus = require("../events/eventBus");

const llmSynthesisEnabled = () => process.env.ENABLE_LLM_SYNTHESIS === "true";

const runMediFastWorkflow = async ({ query, profile, telegramId, location = null, intent = {}, mentionedMember = null } = {}) => {
  const startedAt = Date.now();
  const plan = planWorkflow({ query, profile, location });
  const toolResults = await executeWorkflowTools({ plan, telegramId, profile });
  const evidence = collectEvidence({ query, plan, toolResults });
  const knowledgeContext = toolResults.knowledge?.value?.context || [];
  const memoryFacts = toolResults.memory?.value?.facts || [];
  const fallback = evidence.ragContext.lowConfidence || evidence.medicineContext.message
    ? "I do not have enough confident evidence for this part. Please share the exact medicine name or symptom details."
    : "";
  const shouldSynthesize =
    llmSynthesisEnabled() &&
    !fallback &&
    (knowledgeContext.length > 0 || memoryFacts.length > 0 || evidence.medicineContext.medicine);
  const provider = shouldSynthesize ? createProvider() : null;
  const providerResult = shouldSynthesize
    ? await provider.generate({
        prompt: query,
        fallback,
        context: knowledgeContext,
        memory: memoryFacts,
        evidence,
      })
    : {
        text: fallback,
        provider: "deterministic",
        model: "no-llm-synthesis",
        latencyMs: 0,
        ok: true,
        skipped: true,
      };
  const orchestrationLatencyMs = Date.now() - startedAt;

  eventBus.emitSafe("orchestration.completed", {
    telegramId,
    query,
    toolsExecuted: toolResults.__trace?.map((item) => item.tool) || [],
    toolCount: toolResults.__trace?.length || 0,
    failedWorkflow: Object.values(toolResults).some((result) => result?.ok === false),
    evidenceSize: estimateEvidenceSize(evidence),
    provider: providerResult.provider,
    providerModel: providerResult.model,
    providerLatencyMs: providerResult.latencyMs || 0,
    orchestrationLatencyMs,
    llmSynthesisEnabled: llmSynthesisEnabled(),
    llmSynthesisSkipped: Boolean(providerResult.skipped),
  });

  return mergeWorkflowResponse({
    query,
    plan,
    toolResults,
    providerResult,
    evidence,
    orchestrationLatencyMs,
    intent,
    mentionedMember,
  });
};

module.exports = {
  llmSynthesisEnabled,
  runMediFastWorkflow,
};
