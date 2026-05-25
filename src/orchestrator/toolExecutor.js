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
  const executionTrace = [];
  const medicineQuery = plan.entities?.medicine || plan.entities?.normalizedMedicineQuery || plan.query;

  if (plan.execute.family) {
    results.family = { ok: true, value: profile };
    executionTrace.push({ tool: "family", ok: true });
  }
  if (plan.execute.medicine) {
    results.medicineKnowledge = await safeExecute("searchMedicineKnowledge", { query: medicineQuery });
    executionTrace.push({ tool: "searchMedicineKnowledge", ok: results.medicineKnowledge.ok !== false });
  }
  if (plan.execute.memory && telegramId) {
    results.memory = await safeExecute("retrieveRelevantMemory", { telegramId: String(telegramId), query: plan.query });
    executionTrace.push({ tool: "retrieveRelevantMemory", ok: results.memory.ok !== false });
  }
  if (plan.execute.rag) {
    results.knowledge = await safeExecute("retrieveKnowledge", { question: plan.query });
    executionTrace.push({ tool: "retrieveKnowledge", ok: results.knowledge.ok !== false });
  }
  if (plan.execute.nearby) {
    results.nearby = await safeExecute("recommendNearbyPharmacies", {
      telegramId,
      latitude: plan.location.latitude,
      longitude: plan.location.longitude,
      medicineQuery,
      medicineKnowledge: results.medicineKnowledge?.value,
    });
    executionTrace.push({ tool: "recommendNearbyPharmacies", ok: results.nearby.ok !== false });
  }

  results.__trace = executionTrace;
  return results;
};

module.exports = {
  executeWorkflowTools,
  safeExecute,
};
