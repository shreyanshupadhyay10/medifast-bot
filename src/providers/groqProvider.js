const BaseProvider = require("./baseProvider");

class GroqProvider extends BaseProvider {
  async generate() {
    return {
      text: "Groq provider is configured as a future adapter. Set API wiring before enabling it.",
      provider: "groq",
      model: this.options.model || "future-open-model",
    };
  }
}

module.exports = GroqProvider;
