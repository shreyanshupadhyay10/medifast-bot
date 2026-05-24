const ConversationMemory = require("../models/ConversationMemory");
const { normalizeQuery } = require("./intentEngine");
const { summarizeMemory, MAX_RECENT_MESSAGES } = require("../memory/memorySummarizer");
const { retrieveRelevantMemory, saveFactsToSemanticMemory } = require("../memory/semanticMemory");
const logger = require("../utils/logger");

const CONDITION_TERMS = ["bp", "blood pressure", "diabetes", "sugar", "asthma", "allergy", "thyroid"];

const getConversationMemory = async (telegramId) => {
  if (!telegramId) return null;
  return ConversationMemory.findOneAndUpdate(
    { telegramId: String(telegramId) },
    { $setOnInsert: { telegramId: String(telegramId) } },
    { upsert: true, new: true }
  );
};

const extractFactsFromEntities = (entities = {}) => {
  const facts = [];
  const entity = entities.person || entities.familyMemberName || "self";
  const normalized = entities.normalizedText || "";

  CONDITION_TERMS.forEach((condition) => {
    if (normalized.includes(condition)) {
      facts.push({
        type: condition === "allergy" ? "allergy" : "condition",
        entity,
        value: condition,
        confidence: 0.78,
        source: "message",
      });
    }
  });

  if (entities.symptom) {
    facts.push({
      type: "family_context",
      entity,
      value: entities.symptom,
      confidence: 0.66,
      source: "message",
    });
  }

  return facts;
};

const addConversationTurn = async ({ telegramId, userText, botText, entities }) => {
  if (!telegramId) return null;
  const memory = await getConversationMemory(telegramId);
  const facts = extractFactsFromEntities(entities);

  const newFacts = [];
  facts.forEach((fact) => {
    const exists = memory.facts.some(
      (item) =>
        normalizeQuery(item.type) === normalizeQuery(fact.type) &&
        normalizeQuery(item.entity) === normalizeQuery(fact.entity) &&
        normalizeQuery(item.value) === normalizeQuery(fact.value)
    );
    if (!exists) {
      memory.facts.push(fact);
      newFacts.push(fact);
    }
  });

  if (userText) memory.recentMessages.push({ role: "user", text: userText });
  if (botText) memory.recentMessages.push({ role: "bot", text: botText });

  if (memory.recentMessages.length > MAX_RECENT_MESSAGES) {
    const compressed = summarizeMemory(memory);
    memory.facts = compressed.facts;
    memory.conversationSummary = compressed.conversationSummary;
    memory.recentMessages = compressed.recentMessages;
  }

  if (newFacts.length > 0) {
    try {
      const embeddingIds = await saveFactsToSemanticMemory({ telegramId, facts: newFacts });
      embeddingIds.forEach((embeddingId, index) => {
        const fact = memory.facts[memory.facts.length - newFacts.length + index];
        if (fact) fact.embeddingId = embeddingId;
      });
      memory.embeddingId = embeddingIds[embeddingIds.length - 1] || memory.embeddingId;
    } catch (error) {
      logger.warn(`Semantic memory unavailable: ${error.message}`);
    }
  }

  await memory.save();
  return memory;
};

module.exports = {
  addConversationTurn,
  extractFactsFromEntities,
  getConversationMemory,
  retrieveRelevantMemory,
};
