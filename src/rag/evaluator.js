const RetrievalMetric = require("../models/RetrievalMetric");
const logger = require("../utils/logger");

const evaluateRetrieval = (query, results = [], { retrievalType = "hybrid", latencyMs = 0 } = {}) => {
  const topConfidence = results[0]?.confidence || 0;
  const categories = [...new Set(results.map((result) => result.metadata?.category).filter(Boolean))];
  return {
    query,
    retrievalType,
    hitCount: results.length,
    topConfidence,
    latencyMs,
    categories,
    failed: results.length === 0,
  };
};

const recordRetrievalMetric = async (metric) => {
  try {
    await RetrievalMetric.create(metric);
  } catch (error) {
    logger.warn(`Retrieval metric persistence failed: ${error.message}`);
  }
  return metric;
};

const getRetrievalQualitySummary = async () => {
  const [summary] = await RetrievalMetric.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        failed: { $sum: { $cond: ["$failed", 1, 0] } },
        averageConfidence: { $avg: "$topConfidence" },
        averageLatencyMs: { $avg: "$latencyMs" },
      },
    },
  ]);

  const categoryUsage = await RetrievalMetric.aggregate([
    { $unwind: "$categories" },
    { $group: { _id: "$categories", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 8 },
    { $project: { category: "$_id", count: 1, _id: 0 } },
  ]);

  return {
    retrievalHitRate: summary?.total ? (summary.total - summary.failed) / summary.total : 0,
    topKAccuracy: summary?.total ? (summary.total - summary.failed) / summary.total : 0,
    failedRetrievalCount: summary?.failed || 0,
    averageConfidence: summary?.averageConfidence || 0,
    averageLatencyMs: summary?.averageLatencyMs || 0,
    categoryUsage,
  };
};

module.exports = {
  evaluateRetrieval,
  getRetrievalQualitySummary,
  recordRetrievalMetric,
};
