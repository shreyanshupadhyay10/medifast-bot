const LocalEmbeddingProvider = require("./providers/localEmbeddingProvider");
const FutureOpenAIProvider = require("./providers/futureOpenAIProvider");

const providers = {
  local: LocalEmbeddingProvider,
  future_openai: FutureOpenAIProvider,
};

const createEmbeddingProvider = (
  providerName = process.env.EMBEDDING_PROVIDER || "local",
  options = {}
) => {
  const Provider = providers[providerName] || LocalEmbeddingProvider;
  return new Provider(options);
};

module.exports = {
  createEmbeddingProvider,
};
