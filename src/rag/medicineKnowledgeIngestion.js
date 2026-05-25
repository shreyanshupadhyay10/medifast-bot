const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const MedicineKnowledge = require("../models/MedicineKnowledge");
const { buildRelationships } = require("../medicine/medicineRelationshipService");
const eventBus = require("../events/eventBus");
const { upsertChunks, DEFAULT_COLLECTION, getVectorStoragePath } = require("./retriever");

const DEFAULT_PROGRESS_PATH = path.join(
  process.cwd(),
  "data",
  "chroma",
  "medicine-knowledge-ingestion-progress.json"
);

const sideEffectLabel = (entry) => {
  if (!entry) return null;
  if (typeof entry === "string") return entry;
  const details = [entry.severity && `severity: ${entry.severity}`, entry.frequency && `frequency: ${entry.frequency}`]
    .filter(Boolean)
    .join(", ");
  return details ? `${entry.effect} (${details})` : entry.effect;
};

const unique = (items = []) => [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
const normalize = (value = "") => String(value || "").trim().toLowerCase();
const DEFAULT_PRIORITY_MEDICINES = [
  "dolo",
  "dolo 650",
  "paracetamol",
  "crocin",
  "calpol",
  "pregabalin",
  "lyrica",
  "pregalin",
  "alprax",
  "alprazolam",
  "clonazepam",
  "clonotril",
  "pantoprazole",
  "pantocid",
  "azithromycin",
  "azee",
  "metformin",
  "telma",
  "telmisartan",
  "montek lc",
  "aciloc",
  "telma am",
  "rablet d",
  "glycomet gp",
  "cetzine",
  "augmentin",
];

const priorityTerms = () =>
  unique((process.env.MEDICINE_RAG_PRIORITY_TERMS || DEFAULT_PRIORITY_MEDICINES.join(",")).split(",")).map(normalize);
const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const progressFilePath = () =>
  process.env.MEDICINE_KNOWLEDGE_RAG_PROGRESS_FILE ||
  path.join(getVectorStoragePath() || path.dirname(DEFAULT_PROGRESS_PATH), path.basename(DEFAULT_PROGRESS_PATH));

const readProgress = (filePath = progressFilePath()) => {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
};

const writeProgress = (progress, filePath = progressFilePath()) => {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify({ ...progress, updatedAt: new Date().toISOString() }, null, 2));
};

const baseMetadata = (record = {}, chunkType = "identity") => {
  const sideEffects = unique((record.sideEffects || []).map(sideEffectLabel));
  const generic = record.genericName || record.medicineName;
  return {
    sourceType: "medicineKnowledge",
    chunkType,
    source: record.source || "MedicineKnowledge",
    medicine: record.medicineName || "",
    generic: generic || "",
    category: record.category || "other",
    sideEffects: sideEffects.slice(0, 10).join("; "),
    confidence: Number(record.confidence || 0.75),
    recordId: record._id?.toString?.() || "",
    knowledgeKey: record.knowledgeKey || "",
    updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : new Date().toISOString(),
  };
};

const medicineKnowledgeToChunks = (record = {}) => {
  const sideEffects = unique((record.sideEffects || []).map(sideEffectLabel));
  const relationships = buildRelationships(record);
  const generic = record.genericName || record.medicineName;
  const idBase = `medicine-knowledge:${record.knowledgeKey || record._id}`;
  const chunks = [
    {
      id: `${idBase}:identity`,
      text: [
        `Medicine: ${record.medicineName}`,
        generic && `Generic or salt: ${generic}`,
        record.category && `Category: ${record.category}`,
        record.company && `Manufacturer: ${record.company}`,
        record.brands?.length && `Brands: ${record.brands.join(", ")}`,
        record.aliases?.length && `Aliases: ${record.aliases.join(", ")}`,
        record.salts?.length && `Salts: ${record.salts.join(", ")}`,
        record.symptoms?.length && `Used for discovery around: ${record.symptoms.join(", ")}`,
      ].filter(Boolean).join("\n"),
      metadata: baseMetadata(record, "identity"),
    },
  ];

  if (sideEffects.length || record.precautions?.length || record.prescriptionRequired) {
    chunks.push({
      id: `${idBase}:safety`,
      text: [
        `Medicine safety profile: ${record.medicineName}`,
        generic && `Generic or salt: ${generic}`,
        sideEffects.length && `Known side effects from source data: ${sideEffects.slice(0, 35).join("; ")}`,
        record.precautions?.length && `Precautions: ${record.precautions.join("; ")}`,
        `Prescription required: ${record.prescriptionRequired ? "yes" : "not marked"}`,
      ].filter(Boolean).join("\n"),
      metadata: baseMetadata(record, "safety"),
    });
  }

  if (relationships.length || record.alternatives?.length || record.symptoms?.length) {
    chunks.push({
      id: `${idBase}:relationships`,
      text: [
        `Medicine relationships: ${record.medicineName}`,
        generic && `Generic or salt: ${generic}`,
        record.alternatives?.length && `Alternatives: ${record.alternatives.join(", ")}`,
        record.symptoms?.length && `Symptoms or use cases: ${record.symptoms.join(", ")}`,
        relationships.length && `Relationships: ${relationships.slice(0, 45).map((item) => `${item.type}: ${item.from} -> ${item.to}`).join("; ")}`,
      ].filter(Boolean).join("\n"),
      metadata: baseMetadata(record, "relationships"),
    });
  }

  return chunks.filter((chunk) => chunk.text.trim().length > 0);
};

const medicineKnowledgeToDocument = (record = {}) => {
  const chunks = medicineKnowledgeToChunks(record);
  const primary = chunks[0] || {
    id: `medicine-knowledge:${record.knowledgeKey || record._id}:identity`,
    text: "",
    metadata: baseMetadata(record, "identity"),
  };
  return {
    ...primary,
    id: `medicine-knowledge:${record.knowledgeKey || record._id}`,
    text: chunks.map((chunk) => chunk.text).join("\n"),
    metadata: baseMetadata(record, "combined"),
  };
};

const buildMedicineKnowledgeQuery = ({ updatedAfter } = {}) => {
  const query = {};
  if (updatedAfter) query.updatedAt = { $gte: updatedAfter };
  return query;
};

const priorityQuery = (terms, updatedAfter) => {
  const exactTerms = terms.map((term) => new RegExp(`^${escapeRegex(term)}$`, "i"));
  const query = {
    $or: [
      { medicineNameLower: { $in: terms } },
      { medicineName: { $in: exactTerms } },
      { genericName: { $in: exactTerms } },
      { salts: { $in: exactTerms } },
      { brands: { $in: exactTerms } },
      { aliases: { $in: exactTerms } },
      { commonSpellings: { $in: exactTerms } },
    ],
  };
  if (updatedAfter) query.updatedAt = { $gte: updatedAfter };
  return query;
};

const mergeRecords = (primary = [], secondary = [], limit = 5000) => {
  const map = new Map();
  [...primary, ...secondary].forEach((record) => {
    const key = record.knowledgeKey || record._id?.toString();
    if (key && !map.has(key)) map.set(key, record);
  });
  return [...map.values()].slice(0, limit);
};

const loadMedicineKnowledgeDocuments = async ({ limit = Number(process.env.MEDICINE_KNOWLEDGE_RAG_LIMIT || 5000), updatedAfter } = {}) => {
  const terms = priorityTerms();
  const [priorityRecords, broadRecords] = await Promise.all([
    MedicineKnowledge.find(priorityQuery(terms, updatedAfter)).sort({ confidence: -1, updatedAt: -1 }).limit(Math.min(limit, 500)).lean(),
    MedicineKnowledge.find(buildMedicineKnowledgeQuery({ updatedAfter }))
      .sort({ sourceKind: -1, confidence: -1, updatedAt: -1 })
      .limit(limit)
      .lean(),
  ]);
  const records = mergeRecords(priorityRecords, broadRecords, limit);
  return records.map(medicineKnowledgeToDocument);
};

const buildCursorQuery = ({ updatedAfter, lastId } = {}) => {
  const query = buildMedicineKnowledgeQuery({ updatedAfter });
  if (lastId && mongoose.Types.ObjectId.isValid(lastId)) {
    query._id = { $gt: new mongoose.Types.ObjectId(lastId) };
  }
  return query;
};

const ingestMedicineKnowledgeToRag = async ({
  batchSize = Number(process.env.MEDICINE_KNOWLEDGE_RAG_BATCH_SIZE || 500),
  maxRecords = Number(process.env.MEDICINE_KNOWLEDGE_RAG_MAX_RECORDS || 0),
  incrementalHours = Number(process.env.MEDICINE_KNOWLEDGE_RAG_INCREMENTAL_HOURS || 0),
  collectionName = DEFAULT_COLLECTION,
  resume = process.env.MEDICINE_KNOWLEDGE_RAG_RESUME !== "false",
  progressPath = progressFilePath(),
} = {}) => {
  const startedAt = new Date();
  const updatedAfter = incrementalHours > 0 ? new Date(Date.now() - incrementalHours * 60 * 60 * 1000) : null;
  const existing = resume && !updatedAfter ? readProgress(progressPath) : null;
  let lastId = existing?.complete ? null : existing?.lastId || null;
  let processedRecords = existing?.processedRecords || 0;
  let vectorizedChunks = existing?.vectorizedChunks || 0;
  let batches = existing?.batches || 0;
  let processedThisRun = 0;

  if (existing?.complete && resume && !updatedAfter && !maxRecords) {
    return {
      count: 0,
      collectionName,
      vectorMode: "resume-complete",
      medicineDocuments: 0,
      vectorizedChunks: 0,
      processedRecords,
      totalProcessedRecords: processedRecords,
      batches: 0,
      complete: true,
      skipped: true,
      progressPath,
    };
  }

  writeProgress({
    startedAt: existing?.startedAt || startedAt.toISOString(),
    collectionName,
    lastId,
    processedRecords,
    vectorizedChunks,
    batches,
    complete: false,
  }, progressPath);

  while (true) {
    const remaining = maxRecords ? maxRecords - processedThisRun : batchSize;
    if (maxRecords && remaining <= 0) break;
    const currentBatchSize = Math.min(batchSize, remaining || batchSize);
    const records = await MedicineKnowledge.find(buildCursorQuery({ updatedAfter, lastId }))
      .sort({ _id: 1 })
      .limit(currentBatchSize)
      .lean();

    if (!records.length) {
      writeProgress({
        startedAt: existing?.startedAt || startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        collectionName,
        lastId,
        processedRecords,
        vectorizedChunks,
        batches,
        complete: true,
      }, progressPath);
      eventBus.emitSafe("medicine.catalog.rag.completed", { processedRecords, vectorizedChunks, batches, collectionName });
      return {
        count: vectorizedChunks,
        collectionName,
        medicineDocuments: processedRecords,
        vectorizedChunks,
        processedRecords,
        totalProcessedRecords: processedRecords,
        batches,
        complete: true,
        progressPath,
      };
    }

    const chunks = records.flatMap(medicineKnowledgeToChunks);
    const result = await upsertChunks(chunks, { collectionName });
    lastId = records[records.length - 1]._id.toString();
    processedRecords += records.length;
    processedThisRun += records.length;
    vectorizedChunks += chunks.length;
    batches += 1;

    writeProgress({
      startedAt: existing?.startedAt || startedAt.toISOString(),
      collectionName,
      lastId,
      processedRecords,
      vectorizedChunks,
      batches,
      complete: false,
    }, progressPath);
    eventBus.emitSafe("medicine.catalog.rag.progress", {
      processedRecords,
      processedThisRun,
      vectorizedChunks,
      batchRecords: records.length,
      batchChunks: chunks.length,
      batches,
      collectionName,
    });

    if (result.storagePath && process.env.MEDICINE_KNOWLEDGE_RAG_VERBOSE === "true") {
      console.log(`MedicineKnowledge RAG batch ${batches}: ${records.length} medicines, ${chunks.length} chunks.`);
    }
  }

  return {
    count: vectorizedChunks,
    collectionName,
    medicineDocuments: processedThisRun,
    vectorizedChunks,
    processedRecords,
    totalProcessedRecords: processedRecords,
    batches,
    complete: false,
    progressPath,
  };
};

module.exports = {
  ingestMedicineKnowledgeToRag,
  loadMedicineKnowledgeDocuments,
  medicineKnowledgeToChunks,
  medicineKnowledgeToDocument,
  progressFilePath,
  readProgress,
};
