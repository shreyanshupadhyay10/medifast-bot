const BaseLLMProvider = require("./baseLLMProvider");

const groqTimeoutMs = () => Number(process.env.GROQ_TIMEOUT_MS || 4500);

class GroqProvider extends BaseLLMProvider {
  async generate({ prompt, fallback = "", context = [], memory = [], evidence = null } = {}) {
    const startedAt = Date.now();
    const apiKey = this.options.apiKey || process.env.GROQ_API_KEY;
    const model = this.options.model || process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
    if (!apiKey) {
      return {
        text: fallback || "Groq provider is selected, but GROQ_API_KEY is not set.",
        provider: "groq",
        model,
        latencyMs: Date.now() - startedAt,
        ok: false,
        error: "missing_api_key",
      };
    }

    let timeout;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), groqTimeoutMs());
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: Number(process.env.GROQ_TEMPERATURE || 0.15),
          messages: [
            {
              role: "system",
              content: [
                "You are MediFast AI.",
                "You synthesize only from the supplied evidence.",
                "Never invent medicines, availability, side effects, contraindications, or dosage.",
                "Mention uncertainty clearly. Ask for clarification when confidence is low.",
                "This is medicine discovery support, not diagnosis or prescription.",
              ].join(" "),
            },
            {
              role: "user",
              content: this.buildPrompt({ prompt, context, memory, evidence }),
            },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return {
          text: fallback || `Groq generation failed with status ${response.status}.`,
          provider: "groq",
          model,
          latencyMs: Date.now() - startedAt,
          ok: false,
          error: `http_${response.status}`,
          detail: body.slice(0, 300),
        };
      }

      const body = await response.json();
      return {
        text: body.choices?.[0]?.message?.content || fallback || "",
        provider: "groq",
        model,
        latencyMs: Date.now() - startedAt,
        ok: true,
      };
    } catch (error) {
      return {
        text: fallback || "Groq generation failed. Please try again.",
        provider: "groq",
        model,
        latencyMs: Date.now() - startedAt,
        ok: false,
        error: error.message,
      };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}

module.exports = GroqProvider;
