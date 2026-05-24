const test = require("node:test");
const assert = require("node:assert/strict");
const GroqProvider = require("../src/providers/groqProvider");

test("Groq provider uses evidence prompt and Scout default model", async (t) => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GROQ_API_KEY;
  const originalModel = process.env.GROQ_MODEL;

  process.env.GROQ_API_KEY = "test-key";
  delete process.env.GROQ_MODEL;

  let requestBody = null;
  global.fetch = async (url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: "Evidence-based response" } }] }),
    };
  };

  t.after(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GROQ_MODEL;
    else process.env.GROQ_MODEL = originalModel;
  });

  const result = await new GroqProvider().generate({
    prompt: "Dolo for papa",
    evidence: {
      medicineContext: { medicine: { genericName: "Paracetamol" }, confidence: 0.9 },
    },
  });

  assert.equal(result.text, "Evidence-based response");
  assert.equal(result.model, "meta-llama/llama-4-scout-17b-16e-instruct");
  assert.equal(result.ok, true);
  assert.match(requestBody.messages[1].content, /Structured evidence/);
  assert.match(requestBody.messages[0].content, /Never invent medicines/);
});

test("Groq provider falls back safely when API key is missing", async (t) => {
  const originalKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  t.after(() => {
    if (originalKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalKey;
  });

  const result = await new GroqProvider().generate({ prompt: "test", fallback: "fallback answer" });

  assert.equal(result.text, "fallback answer");
  assert.equal(result.ok, false);
  assert.equal(result.error, "missing_api_key");
});
