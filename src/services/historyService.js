const SearchHistory = require("../models/SearchHistory");
const { normalizeQuery } = require("./intentEngine");
const eventBus = require("../events/eventBus");

const REORDER_WINDOW_DAYS = 45;

const getRecentRepeat = async (telegramId, normalizedQuery) => {
  if (!telegramId || !normalizedQuery) return null;

  const since = new Date(Date.now() - REORDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return SearchHistory.findOne({
    telegramId: String(telegramId),
    normalizedQuery: normalizeQuery(normalizedQuery),
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .lean();
};

const recordSearch = async ({
  telegramId,
  originalQuery,
  normalizedQuery,
  intentKey,
  topMedicineName,
  familyMemberName,
}) => {
  if (!telegramId || !normalizedQuery) return null;

  return SearchHistory.create({
    telegramId: String(telegramId),
    originalQuery,
    normalizedQuery: normalizeQuery(normalizedQuery),
    intentKey,
    topMedicineName,
    familyMemberName,
  });
};

const emitSearchCompleted = (payload) => {
  eventBus.emitSafe("search.completed", payload);
};

const getRecentForFamilyMember = async (telegramId, familyMemberName) => {
  if (!telegramId || !familyMemberName) return null;

  return SearchHistory.findOne({
    telegramId: String(telegramId),
    familyMemberName,
    topMedicineName: { $exists: true, $ne: "" },
  })
    .sort({ createdAt: -1 })
    .lean();
};

module.exports = {
  getRecentForFamilyMember,
  getRecentRepeat,
  emitSearchCompleted,
  recordSearch,
};
