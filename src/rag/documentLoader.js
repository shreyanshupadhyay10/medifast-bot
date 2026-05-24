const fs = require("fs");
const path = require("path");

const KNOWLEDGE_ROOT = path.join(__dirname, "..", "..", "knowledge-base");

const tryRequire = (moduleName) => {
  try {
    return require(moduleName);
  } catch {
    return null;
  }
};

const readFrontMatter = (content, fallbackMetadata) => {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { content, metadata: fallbackMetadata };

  const metadata = { ...fallbackMetadata };
  match[1].split(/\r?\n/).forEach((line) => {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) metadata[key.trim()] = rest.join(":").trim();
  });

  return {
    content: content.slice(match[0].length).trim(),
    metadata,
  };
};

const defaultMetadata = (filePath) => ({
  source: filePath,
  category: path.basename(path.dirname(filePath)),
  trust: "curated",
  updatedAt: new Date().toISOString(),
});

const collectKnowledgeFiles = (root = KNOWLEDGE_ROOT) => {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return collectKnowledgeFiles(fullPath);
    return /\.(md|txt|csv|pdf)$/i.test(entry.name) ? [fullPath] : [];
  });
};

const loadWithLangChain = async (filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  const loaderMap = {
    ".pdf": ["@langchain/community/document_loaders/fs/pdf", "PDFLoader"],
    ".csv": ["@langchain/community/document_loaders/fs/csv", "CSVLoader"],
    ".txt": ["@langchain/community/document_loaders/fs/text", "TextLoader"],
    ".md": ["@langchain/community/document_loaders/fs/text", "TextLoader"],
  };
  const loaderConfig = loaderMap[extension];
  if (!loaderConfig) return null;

  const loaded = tryRequire(loaderConfig[0]);
  const Loader = loaded?.[loaderConfig[1]];
  if (!Loader) return null;

  const loader = new Loader(filePath);
  return loader.load();
};

const loadDocument = async (filePath) => {
  const metadata = defaultMetadata(filePath);
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".pdf") {
    const langChainDocs = await loadWithLangChain(filePath);
    if (langChainDocs?.length) {
      return langChainDocs.map((doc, index) => ({
        pageContent: doc.pageContent,
        metadata: { ...metadata, ...doc.metadata, page: doc.metadata?.loc?.pageNumber || index + 1 },
      }));
    }
  }

  const langChainDocs = extension === ".csv" ? await loadWithLangChain(filePath) : null;
  if (langChainDocs?.length) {
    return langChainDocs.map((doc, index) => ({
      pageContent: doc.pageContent,
      metadata: { ...metadata, ...doc.metadata, row: index + 1 },
    }));
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = readFrontMatter(raw, metadata);
  return [{ pageContent: parsed.content, metadata: parsed.metadata }];
};

const loadKnowledgeBase = async (root = KNOWLEDGE_ROOT) => {
  const files = collectKnowledgeFiles(root);
  const groups = await Promise.all(files.map(loadDocument));
  return groups.flat();
};

module.exports = {
  KNOWLEDGE_ROOT,
  collectKnowledgeFiles,
  loadDocument,
  loadKnowledgeBase,
};
