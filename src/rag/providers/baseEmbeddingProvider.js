class BaseEmbeddingProvider {
  constructor(options = {}) {
    this.options = options;
  }

  async embedQuery() {
    throw new Error("Embedding provider must implement embedQuery().");
  }

  async embedDocuments() {
    throw new Error("Embedding provider must implement embedDocuments().");
  }
}

module.exports = BaseEmbeddingProvider;
