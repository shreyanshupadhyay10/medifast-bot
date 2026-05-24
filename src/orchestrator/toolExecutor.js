const { getTool } = require("../ai/toolRegistry");

const safeExecute = async (toolName, payload) => {
  const tool = getTool(toolName);
  if (!tool) return { ok: false, error: `Tool not registered: ${toolName}` };
  try {
    return {
      ok: true,
      value: await tool.execute(payload),
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
    };
  }
};

const executeWorkflowTools = async ({ plan, telegramId, profile }) => {
  const results = {};

  if (plan.execute.family) {
    results.family = { ok: true, value: profile };
  }
  if (plan.execute.medicine) {
    results.medicineKnowledge = await safeExecute("searchMedicineKnowledge", { query: plan.query });
  }
  if (plan.execute.memory && telegramId) {
    results.memory = await safeExecute("retrieveRelevantMemory", { telegramId: String(telegramId), query: plan.query });
  }
  if (plan.execute.rag) {
    results.knowledge = await safeExecute("retrieveKnowledge", { question: plan.query });
  }
  if (plan.execute.nearby) {
    results.nearby = await safeExecute("recommendNearbyPharmacies", {
      telegramId,
      latitude: plan.location.latitude,
      longitude: plan.location.longitude,
      medicineQuery: plan.query,
      medicineKnowledge: results.medicineKnowledge?.value,
    });
  }

  return results;
};

module.exports = {
  executeWorkflowTools,
  safeExecute,
};
