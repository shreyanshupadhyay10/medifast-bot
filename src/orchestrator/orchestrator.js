const { createProvider } = require("../providers");
const { planWorkflow } = require("./workflowPlanner");
const { executeWorkflowTools } = require("./toolExecutor");
const { mergeWorkflowResponse } = require("./responseMerger");

const runMediFastWorkflow = async ({ query, profile, telegramId, location = null, intent = {}, mentionedMember = null } = {}) => {
  const plan = planWorkflow({ query, profile, location });
  const toolResults = await executeWorkflowTools({ plan, telegramId, profile });
  const provider = createProvider();
  const knowledgeContext = toolResults.knowledge?.value?.context || [];
  const memoryFacts = toolResults.memory?.value?.facts || [];
  const providerResult = await provider.generate({
    prompt: query,
    fallback: "",
    context: knowledgeContext,
    memory: memoryFacts,
  });

  return mergeWorkflowResponse({
    query,
    plan,
    toolResults,
    providerResult,
    intent,
    mentionedMember,
  });
};

module.exports = {
  runMediFastWorkflow,
};
