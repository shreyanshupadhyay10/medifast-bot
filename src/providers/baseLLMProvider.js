class BaseLLMProvider {
  constructor(options = {}) {
    this.options = options;
  }

  buildPrompt({ prompt = "", context = [], memory = [] } = {}) {
    const contextText = context.map((item, index) => `${index + 1}. ${item.text || item}`).join("\n");
    const memoryText = memory.map((fact) => `${fact.entity || "memory"}: ${fact.value || fact.text || ""}`).join("\n");
    return [
      "You are MediFast AI, an India-first medicine discovery assistant.",
      "Use retrieved context and tool results only. Do not invent medical facts. Keep the answer concise and safety-first.",
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
