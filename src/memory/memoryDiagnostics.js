const ConversationMemory = require("../models/ConversationMemory");
const { DEFAULT_MEMORY_COLLECTION, getCollection, getVectorMode, getVectorStoragePath } = require("../rag/retriever");

const diagnoseMemory = async () => {
  const [profiles, factAgg, typeAgg, example] = await Promise.all([
    ConversationMemory.countDocuments(),
    ConversationMemory.aggregate([
      { $project: { count: { $size: { $ifNull: ["$facts", []] } } } },
      { $group: { _id: null, total: { $sum: "$count" } } },
    ]),
    ConversationMemory.aggregate([
      { $unwind: "$facts" },
      { $group: { _id: "$facts.type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { type: "$_id", count: 1, _id: 0 } },
    ]),
    ConversationMemory.findOne({ "facts.0": { $exists: true } }).lean(),
  ]);

  let vectorCount = 0;
  let vectorError = null;
  try {
    const collection = await getCollection(DEFAULT_MEMORY_COLLECTION);
    vectorCount = await collection.count();
  } catch (error) {
    vectorError = error.message;
  }

  return {
    profiles,
    storedFacts: factAgg[0]?.total || 0,
    factTypes: typeAgg,
    vectorMode: getVectorMode(),
    vectorCount,
    vectorError,
    storagePath: getVectorStoragePath(),
    example: example
      ? {
          telegramId: example.telegramId,
          facts: example.facts?.slice(0, 5) || [],
          summary: example.conversationSummary,
        }
      : null,
  };
};

module.exports = {
  diagnoseMemory,
};
