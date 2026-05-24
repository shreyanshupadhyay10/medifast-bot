const tryRequire = (moduleName) => {
  try {
    return require(moduleName);
  } catch {
    return null;
  }
};

const fallbackSplit = (text, chunkSize, chunkOverlap) => {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize));
    start += Math.max(chunkSize - chunkOverlap, 1);
  }
  return chunks;
};

const chunkDocuments = async (documents, { chunkSize = 900, chunkOverlap = 120 } = {}) => {
  const splitterModule = tryRequire("@langchain/textsplitters");
  const Splitter = splitterModule?.RecursiveCharacterTextSplitter;

  if (Splitter) {
    const splitter = new Splitter({ chunkSize, chunkOverlap });
    const chunks = await splitter.splitDocuments(documents);
    return chunks.map((chunk, index) => ({
      id: `${chunk.metadata.source || "doc"}:${chunk.metadata.page || chunk.metadata.row || 0}:${index}`,
      text: chunk.pageContent,
      metadata: {
        source: chunk.metadata.source || "",
        category: chunk.metadata.category || "uncategorized",
        trust: chunk.metadata.trust || "curated",
        updatedAt: chunk.metadata.updatedAt || new Date().toISOString(),
        chunkIndex: index,
      },
    }));
  }

  return documents.flatMap((doc, docIndex) =>
    fallbackSplit(doc.pageContent, chunkSize, chunkOverlap).map((text, chunkIndex) => ({
      id: `${doc.metadata.source || "doc"}:${docIndex}:${chunkIndex}`,
      text,
      metadata: {
        source: doc.metadata.source || "",
        category: doc.metadata.category || "uncategorized",
        trust: doc.metadata.trust || "curated",
        updatedAt: doc.metadata.updatedAt || new Date().toISOString(),
        chunkIndex,
      },
    }))
  );
};

module.exports = {
  chunkDocuments,
};
