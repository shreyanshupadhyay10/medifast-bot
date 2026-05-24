const DeterministicProvider = require("./deterministicProvider");
const GroqProvider = require("./groqProvider");
const LlamaProvider = require("./llamaProvider");

const providers = {
  deterministic: DeterministicProvider,
  groq: GroqProvider,
  llama: LlamaProvider,
};

const createProvider = (name = process.env.AI_PROVIDER || "deterministic", options = {}) => {
  const Provider = providers[name] || DeterministicProvider;
  return new Provider(options);
};

module.exports = {
  createProvider,
};
