const BaseLLMProvider = require("./baseLLMProvider");

class LocalLlamaProvider extends BaseLLMProvider {
  async generate({ prompt, fallback = "", context = [], memory = [] } = {}) {
    const endpoint = this.options.endpoint || process.env.LOCAL_LLM_URL;
    if (!endpoint) {
      return {
        text: fallback || "Local Llama provider is configured, but LOCAL_LLM_URL is not set.",
        provider: "local-llama",
        model: this.options.model || process.env.LOCAL_LLM_MODEL || "local-llama",
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.options.model || process.env.LOCAL_LLM_MODEL || "llama3",
        prompt: this.buildPrompt({ prompt, context, memory }),
        stream: false,
      }),
    });
    const body = await response.json();
    return {
      text: body.response || body.text || fallback || "",
      provider: "local-llama",
      model: body.model || this.options.model || process.env.LOCAL_LLM_MODEL || "llama3",
    };
  }
}

module.exports = LocalLlamaProvider;
