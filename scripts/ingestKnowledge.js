require("dotenv").config();
const fs = require("fs");
const path = require("path");
const connectDB = require("../config/database");
const { loadKnowledgeBase } = require("../src/rag/documentLoader");
const { chunkDocuments } = require("../src/rag/chunker");
const { upsertChunks } = require("../src/rag/retriever");
const { ingestMedicineKnowledgeToRag } = require("../src/rag/medicineKnowledgeIngestion");

const KNOWLEDGE_ROOT = path.join(__dirname, "..", "knowledge-base");

const parseMetadata = (content, filePath) => {
  const frontMatter = content.match(/^---\n([\s\S]*?)\n---/);
  const metadata = {
    source: filePath,
    category: path.basename(path.dirname(filePath)),
    trust: "curated",
    updatedAt: new Date().toISOString(),
  };

  if (!frontMatter) return metadata;

  frontMatter[1].split("\n").forEach((line) => {
    const [key, ...rest] = line.split(":");
    if (key && rest.length) metadata[key.trim()] = rest.join(":").trim();
  });

  return metadata;
};

const collectKnowledgeFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectKnowledgeFiles(fullPath);
    return /\.(md|txt|csv)$/i.test(entry.name) ? [fullPath] : [];
  });
};

const run = async () => {
  await connectDB();
  const files = collectKnowledgeFiles(KNOWLEDGE_ROOT);
  const documents = await loadKnowledgeBase(KNOWLEDGE_ROOT);
  const chunks = await chunkDocuments(documents);
  const result = await upsertChunks(chunks);
  const medicineResult = await ingestMedicineKnowledgeToRag();

  console.log(`Knowledge ingestion complete. Found ${files.length} file(s), ${documents.length} document(s), ${chunks.length} chunk(s).`);
  documents.forEach((doc) => {
    const metadata = doc.metadata || parseMetadata(doc.pageContent || "", "");
    console.log(`- ${metadata.category}: ${path.basename(metadata.source || "unknown")} [trust=${metadata.trust}]`);
  });
  console.log(`Saved ${result.count} vector(s) into vector collection "${result.collectionName}" [mode=${result.vectorMode}].`);
  console.log(
    `MedicineKnowledge RAG activation: processed ${medicineResult.medicineDocuments} record(s) this run, ` +
      `${medicineResult.vectorizedChunks || medicineResult.count} total chunk(s), complete=${medicineResult.complete}.`
  );
  if (medicineResult.progressPath) console.log(`MedicineKnowledge progress: ${medicineResult.progressPath}`);
  if (result.storagePath) console.log(`Local vector storage: ${result.storagePath}`);
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
