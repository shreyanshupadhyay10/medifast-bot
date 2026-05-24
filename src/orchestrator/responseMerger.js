const { assessSafety } = require("../ai/safetyGuard");

const mergeWorkflowResponse = ({ query, plan, toolResults, providerResult, evidence, orchestrationLatencyMs, intent, mentionedMember } = {}) => {
  const knowledgeContext = toolResults.knowledge?.value?.context || [];
  const memoryFacts = toolResults.memory?.value?.facts || [];
  const medicine = toolResults.medicineKnowledge?.value?.medicine || null;
  const nearby = toolResults.nearby?.value || null;
  const safety = assessSafety({ entities: plan.entities, intent, mentionedMember, query });

  return {
    query,
    entities: plan.entities,
    routes: plan.routes,
    medicine,
    medicineConfidence: toolResults.medicineKnowledge?.value?.confidence || 0,
    memory: memoryFacts,
    knowledge: {
      context: knowledgeContext,
      confidence: toolResults.knowledge?.value?.confidence || 0,
      sources: toolResults.knowledge?.value?.sources || [],
    },
    nearby,
    generated: providerResult,
    evidence,
    orchestrationLatencyMs,
    safety,
    debug: {
      tools: Object.fromEntries(Object.entries(toolResults).filter(([name]) => name !== "__trace").map(([name, result]) => [name, result.ok !== false])),
      errors: Object.fromEntries(Object.entries(toolResults).filter(([, result]) => result.ok === false).map(([name, result]) => [name, result.error])),
      toolSequence: toolResults.__trace?.map((item) => item.tool) || plan.toolSequence || [],
      providerLatencyMs: providerResult?.latencyMs || 0,
    },
  };
};

module.exports = {
  mergeWorkflowResponse,
};
