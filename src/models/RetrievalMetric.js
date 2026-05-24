const mongoose = require("mongoose");

const retrievalMetricSchema = new mongoose.Schema(
  {
    query: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    retrievalType: {
      type: String,
      enum: ["vector", "keyword", "hybrid", "memory", "knowledge"],
      default: "hybrid",
      index: true,
    },
    hitCount: {
      type: Number,
      default: 0,
    },
    topConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0,
    },
    latencyMs: {
      type: Number,
      default: 0,
    },
    categories: [String],
    failed: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RetrievalMetric", retrievalMetricSchema);
