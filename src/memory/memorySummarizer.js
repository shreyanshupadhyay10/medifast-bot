const MAX_RECENT_MESSAGES = 12;
const IMPORTANT_FACT_TYPES = new Set(["condition", "allergy", "family_context", "preference"]);

const summarizeMemory = (memory) => {
  if (!memory) {
    return {
      facts: [],
      conversationSummary: "",
      recentMessages: [],
    };
  }

  const facts = (memory.facts || []).filter((fact) => IMPORTANT_FACT_TYPES.has(fact.type));
  const recentMessages = (memory.recentMessages || []).slice(-MAX_RECENT_MESSAGES);
  const factSummary = facts
    .slice(-8)
    .map((fact) => `${fact.entity}: ${fact.value}`)
    .join("; ");

  return {
    facts,
    conversationSummary: factSummary || memory.conversationSummary || "",
    recentMessages,
  };
};

module.exports = {
  MAX_RECENT_MESSAGES,
  summarizeMemory,
};
