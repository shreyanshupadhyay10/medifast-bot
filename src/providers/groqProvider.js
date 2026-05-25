const BaseLLMProvider = require("./baseLLMProvider");
const eventBus = require("../events/eventBus");

const groqTimeoutMs = () => Number(process.env.GROQ_TIMEOUT_MS || 4500);
const evidenceHasUrl = ({ context = [], evidence = null } = {}) => /https?:\/\//i.test(JSON.stringify({ context, evidence }));
const sanitizeGeneratedText = (text = "", { allowUrls = false } = {}) =>
  String(text || "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*confidence\s*:/i.test(line))
    .filter((line) => !/^\s*sources?\s*:/i.test(line))
    .filter((line) => allowUrls || !/https?:\/\//i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

class GroqProvider extends BaseLLMProvider {
  async generate({ prompt, fallback = "", context = [], memory = [], evidence = null } = {}) {
    const startedAt = Date.now();
    const apiKey = this.options.apiKey || process.env.GROQ_API_KEY;
    const model = this.options.model || process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
    if (!apiKey) {
      eventBus.emitSafe("llm.groq.used", {
        model,
        latencyMs: Date.now() - startedAt,
        ok: false,
        error: "missing_api_key",
      });
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
                "Do not output source URLs or confidence scores unless they are explicitly present in the supplied evidence.",
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
        eventBus.emitSafe("llm.groq.used", {
          model,
          latencyMs: Date.now() - startedAt,
          ok: false,
          error: `http_${response.status}`,
        });
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
      const latencyMs = Date.now() - startedAt;
      eventBus.emitSafe("llm.groq.used", {
        model,
        latencyMs,
        ok: true,
      });
      return {
        text: sanitizeGeneratedText(body.choices?.[0]?.message?.content || fallback || "", {
          allowUrls: evidenceHasUrl({ context, evidence }),
        }),
        provider: "groq",
        model,
        latencyMs,
        ok: true,
      };
    } catch (error) {
      eventBus.emitSafe("llm.groq.used", {
        model,
        latencyMs: Date.now() - startedAt,
        ok: false,
        error: error.message,
      });
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
