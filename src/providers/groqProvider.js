const BaseLLMProvider = require("./baseLLMProvider");

class GroqProvider extends BaseLLMProvider {
  async generate({ prompt, fallback = "", context = [], memory = [] } = {}) {
    const apiKey = this.options.apiKey || process.env.GROQ_API_KEY;
    const model = this.options.model || process.env.GROQ_MODEL || "llama-3.1-8b-instant";
    if (!apiKey) {
      return {
        text: fallback || "Groq provider is selected, but GROQ_API_KEY is not set.",
        provider: "groq",
        model,
      };
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You are MediFast AI. Use only tool output and retrieved context. Do not prescribe. Keep medical safety notes short.",
          },
          {
            role: "user",
            content: this.buildPrompt({ prompt, context, memory }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return {
        text: fallback || `Groq generation failed with status ${response.status}.`,
        provider: "groq",
        model,
      };
    }

    const body = await response.json();
    return {
      text: body.choices?.[0]?.message?.content || fallback || "",
      provider: "groq",
      model,
    };
  }
}

module.exports = GroqProvider;
