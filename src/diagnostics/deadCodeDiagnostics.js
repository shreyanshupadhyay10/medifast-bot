const fs = require("fs");
const path = require("path");

const SRC_ROOT = path.join(__dirname, "..");
const ENTRYPOINTS = new Set(["index.js", "server.js"]);

const walkJs = (dir = SRC_ROOT) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkJs(fullPath);
    return entry.name.endsWith(".js") ? [fullPath] : [];
  });
};

const normalizeRequireTarget = (fromFile, target) => {
  if (!target.startsWith(".")) return null;
  const absolute = path.resolve(path.dirname(fromFile), target);
  const jsPath = absolute.endsWith(".js") ? absolute : `${absolute}.js`;
  return fs.existsSync(jsPath) ? jsPath : null;
};

const diagnoseDeadCode = () => {
  const files = walkJs();
  const referenced = new Set();
  files.forEach((file) => {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/require\(["']([^"']+)["']\)/g)) {
      const target = normalizeRequireTarget(file, match[1]);
      if (target) referenced.add(target);
    }
  });

  const candidates = files
    .filter((file) => !ENTRYPOINTS.has(path.basename(file)))
    .filter((file) => !referenced.has(file))
    .map((file) => path.relative(path.join(SRC_ROOT, ".."), file).replace(/\\/g, "/"))
    .slice(0, 25);

  return {
    scannedFiles: files.length,
    referencedFiles: referenced.size,
    candidateCount: candidates.length,
    candidates,
  };
};

module.exports = {
  diagnoseDeadCode,
};
