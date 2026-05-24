const BaseEmbeddingProvider = require("./baseEmbeddingProvider");

class FutureOpenAIProvider extends BaseEmbeddingProvider {
  async embedQuery() {
    throw new Error("OpenAI embeddings are intentionally not enabled. Use local embeddings by default.");
  }

  async embedDocuments() {
    throw new Error("OpenAI embeddings are intentionally not enabled. Use local embeddings by default.");
  }
}

module.exports = FutureOpenAIProvider;
