class BaseLLMProvider {
  constructor(options = {}) {
    this.options = options;
  }

  buildPrompt({ prompt = "", context = [], memory = [], evidence = null } = {}) {
    const contextText = context.map((item, index) => `${index + 1}. ${item.text || item}`).join("\n");
    const memoryText = memory.map((fact) => `${fact.entity || "memory"}: ${fact.value || fact.text || ""}`).join("\n");
    const evidenceText = evidence ? JSON.stringify(evidence, null, 2).slice(0, 12000) : "";
    return [
      "You are MediFast AI, an India-first medicine discovery assistant.",
      "Use retrieved context and tool results only. Do not invent medicines, pharmacy stock, side effects, or dosage.",
      "If evidence is weak or missing, ask a short clarification question instead of guessing.",
      "Keep confidence and safety warnings intact. Keep the answer concise and safety-first.",
      evidenceText && `Structured evidence:\n${evidenceText}`,
      memoryText && `Relevant memory:\n${memoryText}`,
      contextText && `Retrieved context:\n${contextText}`,
      `User question:\n${prompt}`,
    ].filter(Boolean).join("\n\n");
  }

  async generate() {
    throw new Error("LLM provider must implement generate().");
  }
}

module.exports = BaseLLMProvider;
