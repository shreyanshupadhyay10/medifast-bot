const DeterministicProvider = require("./deterministicProvider");
const GroqProvider = require("./groqProvider");
const LlamaProvider = require("./llamaProvider");
const LocalLlamaProvider = require("./localLlamaProvider");

const providers = {
  deterministic: DeterministicProvider,
  groq: GroqProvider,
  llama: LlamaProvider,
  "local-llama": LocalLlamaProvider,
};

const createProvider = (name = process.env.LLM_PROVIDER || process.env.AI_PROVIDER || "groq", options = {}) => {
  const Provider = providers[name] || DeterministicProvider;
  return new Provider(options);
};

module.exports = {
  createProvider,
};
