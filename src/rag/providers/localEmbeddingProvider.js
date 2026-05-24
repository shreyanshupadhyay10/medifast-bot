const BaseEmbeddingProvider = require("./baseEmbeddingProvider");
const logger = require("../../utils/logger");

const MODEL_NAME = process.env.LOCAL_EMBEDDING_MODEL || "Xenova/all-MiniLM-L6-v2";

let pipelinePromise = null;

const loadPipeline = async () => {
  if (!pipelinePromise) {
    pipelinePromise = import("@xenova/transformers").then(({ pipeline }) =>
      pipeline("feature-extraction", MODEL_NAME)
    );
  }
  return pipelinePromise;
};

class LocalEmbeddingProvider extends BaseEmbeddingProvider {
  async embedText(text) {
    try {
      const extractor = await loadPipeline();
      const output = await extractor(String(text || ""), {
        pooling: "mean",
        normalize: true,
      });
      return Array.from(output.data);
    } catch (error) {
      logger.warn(`Local embedding provider unavailable: ${error.message}`);
      throw error;
    }
  }

  async embedQuery(text) {
    return this.embedText(text);
  }

  async embedDocuments(texts) {
    const vectors = [];
    for (const text of texts) {
      vectors.push(await this.embedText(text));
    }
    return vectors;
  }
}

module.exports = LocalEmbeddingProvider;
