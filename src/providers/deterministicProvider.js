const BaseProvider = require("./baseProvider");

class DeterministicProvider extends BaseProvider {
  async generate({ prompt, fallback = "", context = [], memory = [] }) {
    const contextLine = context.length
      ? `Knowledge context found from ${context.length} trusted source(s).`
      : "";
    const memoryLine = memory.length
      ? `Relevant family memory: ${memory.map((fact) => `${fact.entity}: ${fact.value}`).join("; ")}.`
      : "";
    return {
      text: [fallback || prompt || "", memoryLine, contextLine].filter(Boolean).join("\n"),
      provider: "deterministic",
      model: "rules",
    };
  }
}

module.exports = DeterministicProvider;
