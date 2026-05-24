const mongoose = require("mongoose");

const pharmacySearchHistorySchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      index: true,
    },
    query: {
      type: String,
      trim: true,
    },
    normalizedMedicine: {
      type: String,
      trim: true,
      index: true,
    },
    latitude: Number,
    longitude: Number,
    radiusKm: Number,
    expandedRadius: {
      type: Boolean,
      default: false,
    },
    resultCount: {
      type: Number,
      default: 0,
    },
    inventoryMatchCount: {
      type: Number,
      default: 0,
    },
    topPharmacyName: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PharmacySearchHistory", pharmacySearchHistorySchema);
