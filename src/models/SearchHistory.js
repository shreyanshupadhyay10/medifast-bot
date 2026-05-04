const mongoose = require("mongoose");

const searchHistorySchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      required: true,
      index: true,
    },
    originalQuery: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedQuery: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    intentKey: {
      type: String,
      trim: true,
    },
    topMedicineName: {
      type: String,
      trim: true,
    },
    familyMemberName: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

searchHistorySchema.index({ telegramId: 1, normalizedQuery: 1, createdAt: -1 });

module.exports = mongoose.model("SearchHistory", searchHistorySchema);
