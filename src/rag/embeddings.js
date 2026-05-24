const { createEmbeddingProvider } = require("./embeddingProvider");

const createEmbeddings = () => createEmbeddingProvider();

module.exports = {
  createEmbeddings,
};
