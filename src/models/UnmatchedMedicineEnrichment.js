const mongoose = require("mongoose");

const unmatchedMedicineEnrichmentSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    enrichmentType: {
      type: String,
      required: true,
      index: true,
    },
    sourceFile: {
      type: String,
      trim: true,
    },
    rawIdentity: {
      type: String,
      trim: true,
    },
    normalizedIdentity: {
      type: String,
      trim: true,
      index: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    reason: {
      type: String,
      trim: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UnmatchedMedicineEnrichment", unmatchedMedicineEnrichmentSchema);
