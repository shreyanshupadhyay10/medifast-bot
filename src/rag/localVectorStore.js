const fs = require("fs");
const path = require("path");

const DEFAULT_STORAGE_PATH = path.join(__dirname, "..", "..", "data", "chroma");

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

const safeCollectionName = (name) => String(name || "default").replace(/[^a-zA-Z0-9_-]/g, "_");

const cosineSimilarity = (left = [], right = []) => {
  if (!left.length || !right.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftMag = 0;
  let rightMag = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMag += left[index] ** 2;
    rightMag += right[index] ** 2;
  }
  if (!leftMag || !rightMag) return 0;
  return dot / (Math.sqrt(leftMag) * Math.sqrt(rightMag));
};

const metadataMatches = (metadata = {}, where = {}) =>
  Object.entries(where || {}).every(([key, value]) => String(metadata[key] ?? "") === String(value));

class LocalVectorCollection {
  constructor({ name, storagePath = process.env.CHROMA_LOCAL_PATH || DEFAULT_STORAGE_PATH } = {}) {
    this.name = name;
    this.storagePath = storagePath;
    ensureDir(storagePath);
    this.filePath = path.join(storagePath, `${safeCollectionName(name)}.json`);
  }

  read() {
    if (!fs.existsSync(this.filePath)) {
      return {
        name: this.name,
        createdAt: new Date().toISOString(),
        records: [],
      };
    }
    return JSON.parse(fs.readFileSync(this.filePath, "utf8"));
  }

  write(data) {
    ensureDir(this.storagePath);
    fs.writeFileSync(this.filePath, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2));
  }

  async upsert({ ids = [], documents = [], embeddings = [], metadatas = [] } = {}) {
    const data = this.read();
    const byId = new Map((data.records || []).map((record) => [record.id, record]));

    ids.forEach((id, index) => {
      byId.set(id, {
        id,
        document: documents[index] || "",
        embedding: embeddings[index] || [],
        metadata: metadatas[index] || {},
      });
    });

    this.write({
      ...data,
      records: [...byId.values()],
    });
  }

  async query({ queryEmbeddings = [], nResults = 4, where = {} } = {}) {
    const data = this.read();
    const queryEmbedding = queryEmbeddings[0] || [];
    const ranked = (data.records || [])
      .filter((record) => metadataMatches(record.metadata, where))
      .map((record) => {
        const similarity = cosineSimilarity(queryEmbedding, record.embedding);
        return {
          ...record,
          distance: 1 - similarity,
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, nResults);

    return {
      ids: [ranked.map((record) => record.id)],
      documents: [ranked.map((record) => record.document)],
      metadatas: [ranked.map((record) => record.metadata)],
      distances: [ranked.map((record) => record.distance)],
    };
  }

  async count() {
    return this.read().records.length;
  }
}

const getLocalCollection = async ({ name, storagePath } = {}) => new LocalVectorCollection({ name, storagePath });

module.exports = {
  DEFAULT_STORAGE_PATH,
  LocalVectorCollection,
  cosineSimilarity,
  getLocalCollection,
  metadataMatches,
};
