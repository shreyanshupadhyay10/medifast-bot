const BaseProvider = require("./baseProvider");

class LlamaProvider extends BaseProvider {
  async generate() {
    return {
      text: "Local Llama provider is configured as a future adapter. Add runtime wiring before enabling it.",
      provider: "llama",
      model: this.options.model || "local-llama",
    };
  }
}

module.exports = LlamaProvider;
