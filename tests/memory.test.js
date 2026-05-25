const test = require("node:test");
const assert = require("node:assert/strict");
const { extractFactsFromEntities } = require("../src/services/memoryService");
const { summarizeMemory } = require("../src/memory/memorySummarizer");

test("extracts structured condition facts from entities", () => {
  const facts = extractFactsFromEntities({
    person: "papa",
    normalizedText: "papa has bp and diabetes",
  });

  assert.deepEqual(
    facts.map((fact) => `${fact.entity}:${fact.value}`),
    ["papa:papa", "papa:bp", "papa:diabetes"]
  );
  assert.equal(facts[0].type, "family_relationship");
});

test("summarizer keeps important facts and bounds recent messages", () => {
  const memory = {
    facts: [
      { type: "condition", entity: "papa", value: "bp" },
      { type: "noise", entity: "self", value: "hello" },
    ],
    recentMessages: Array.from({ length: 20 }, (_, index) => ({
      role: "user",
      text: `message ${index}`,
    })),
  };

  const summary = summarizeMemory(memory);
  assert.equal(summary.facts.length, 1);
  assert.equal(summary.recentMessages.length, 12);
  assert.match(summary.conversationSummary, /papa: bp/);
});
