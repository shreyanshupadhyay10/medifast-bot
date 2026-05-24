const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { detectFieldMap, mapRecordFields } = require("./fieldMapper");

const SOURCE_ROOT = path.join(__dirname, "..", "..", "..", "data", "medicine-sources");

const listSourceFiles = (root = SOURCE_ROOT) => {
  if (!fs.existsSync(root)) return [];
  if (fs.statSync(root).isFile()) return /\.(csv|json)$/i.test(root) ? [root] : [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return listSourceFiles(fullPath);
    return /\.(csv|json)$/i.test(entry.name) ? [fullPath] : [];
  });
};

const readSourceFile = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  if (/\.json$/i.test(filePath)) {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : parsed.records || [];
  }
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
};

const loadSources = (root = SOURCE_ROOT) =>
  listSourceFiles(root).map((filePath) => {
    const rawRecords = readSourceFile(filePath);
    const headers = rawRecords[0] ? Object.keys(rawRecords[0]) : [];
    const fieldMap = detectFieldMap(headers);
    return {
      filePath,
      sourceName: path.basename(filePath),
      fieldMap,
      records: rawRecords.map((record) => ({
        ...mapRecordFields(record, fieldMap),
        source: path.basename(filePath),
      })),
    };
  });

module.exports = {
  SOURCE_ROOT,
  listSourceFiles,
  loadSources,
  readSourceFile,
};
