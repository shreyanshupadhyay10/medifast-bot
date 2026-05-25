const Inventory = require("../models/Inventory");
const Pharmacy = require("../models/Pharmacy");
const SearchHistory = require("../models/SearchHistory");
const SosRequest = require("../models/SosRequest");
const UserProfile = require("../models/UserProfile");
const AnalyticsEvent = require("../models/AnalyticsEvent");
const RetrievalMetric = require("../models/RetrievalMetric");
const PharmacySearchHistory = require("../models/PharmacySearchHistory");

const aggregateTop = async (field, limit = 5) =>
  SearchHistory.aggregate([
    { $match: { [field]: { $exists: true, $nin: [null, ""] } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { name: "$_id", count: 1, _id: 0 } },
  ]);

const getAnalyticsSummary = async () => {
  const [
    topMedicines,
    topSymptoms,
    repeatSearches,
    sosTrends,
    familyProfiles,
    activePharmacies,
    geoReadyPharmacies,
    medicinesInStock,
    retrievalUsage,
    failedMedicineLookups,
    retrievalQuality,
    medicineKnowledgeEvents,
    latestImport,
    latestSideEffectsEnrichment,
    pharmacySearchStats,
    pharmacyConfidenceQuality,
    locationPermissionAccepted,
    pharmacyRankingUsage,
    latestPharmacyImport,
    orchestrationStats,
    providerStats,
    sideEffectQueries,
    groqUsage,
    estimatedPharmacyConfidenceUsage,
  ] = await Promise.all([
    aggregateTop("topMedicineName"),
    aggregateTop("intentKey"),
    SearchHistory.aggregate([
      { $group: { _id: { telegramId: "$telegramId", normalizedQuery: "$normalizedQuery" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { query: "$_id.normalizedQuery", count: 1, _id: 0 } },
    ]),
    SosRequest.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $project: { status: "$_id", count: 1, _id: 0 } },
    ]),
    UserProfile.countDocuments({ "familyMembers.0": { $exists: true } }),
    Pharmacy.countDocuments({ isActive: true }),
    Pharmacy.countDocuments({
      isActive: true,
      $or: [
        {
          "geoLocation.coordinates.0": { $exists: true },
          "geoLocation.coordinates.1": { $exists: true },
        },
        {
          "location.coordinates.0": { $exists: true },
          "location.coordinates.1": { $exists: true },
        },
      ],
    }),
    Inventory.countDocuments({ inStock: true }),
    AnalyticsEvent.aggregate([
      { $match: { eventType: "retrieval.completed" } },
      {
        $group: {
          _id: "$metadata.type",
          count: { $sum: 1 },
          hits: { $sum: "$metadata.hitCount" },
        },
      },
      { $project: { type: "$_id", count: 1, hits: 1, _id: 0 } },
    ]),
    AnalyticsEvent.countDocuments({ eventType: "medicine.lookup.failed" }),
    RetrievalMetric.aggregate([
      {
        $group: {
          _id: "$retrievalType",
          count: { $sum: 1 },
          failed: { $sum: { $cond: ["$failed", 1, 0] } },
          avgConfidence: { $avg: "$topConfidence" },
          avgLatencyMs: { $avg: "$latencyMs" },
        },
      },
      { $project: { type: "$_id", count: 1, failed: 1, avgConfidence: 1, avgLatencyMs: 1, _id: 0 } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { eventType: { $in: ["medicine.knowledge.normalized", "medicine.knowledge.unknown"] } } },
      { $group: { _id: "$eventType", count: { $sum: 1 } } },
      { $project: { eventType: "$_id", count: 1, _id: 0 } },
    ]),
    AnalyticsEvent.findOne({ eventType: "medicine.import.completed" }).sort({ createdAt: -1 }).lean(),
    AnalyticsEvent.findOne({ eventType: "medicine.side_effects.enrichment.completed" }).sort({ createdAt: -1 }).lean(),
    PharmacySearchHistory.aggregate([
      {
        $group: {
          _id: null,
          nearbySearches: { $sum: 1 },
          inventoryMatches: { $sum: "$inventoryMatchCount" },
          avgResultCount: { $avg: "$resultCount" },
          expandedSearches: { $sum: { $cond: ["$expandedRadius", 1, 0] } },
        },
      },
      { $project: { _id: 0, nearbySearches: 1, inventoryMatches: 1, avgResultCount: 1, expandedSearches: 1 } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { eventType: "pharmacy.ranking.completed" } },
      { $group: { _id: null, avgConfidenceQuality: { $avg: "$metadata.confidenceQuality" }, count: { $sum: 1 } } },
      { $project: { _id: 0, avgConfidenceQuality: 1, count: 1 } },
    ]),
    AnalyticsEvent.countDocuments({ eventType: "location.permission.accepted" }),
    AnalyticsEvent.countDocuments({ eventType: "pharmacy.ranking.completed" }),
    AnalyticsEvent.findOne({ eventType: "pharmacy.import.completed" }).sort({ createdAt: -1 }).lean(),
    AnalyticsEvent.aggregate([
      { $match: { eventType: "orchestration.completed" } },
      {
        $group: {
          _id: null,
          workflows: { $sum: 1 },
          failedWorkflows: { $sum: { $cond: ["$metadata.failedWorkflow", 1, 0] } },
          avgToolCount: { $avg: "$metadata.toolCount" },
          avgEvidenceSize: { $avg: "$metadata.evidenceSize" },
          avgProviderLatencyMs: { $avg: "$metadata.providerLatencyMs" },
          avgOrchestrationLatencyMs: { $avg: "$metadata.orchestrationLatencyMs" },
        },
      },
      { $project: { _id: 0 } },
    ]),
    AnalyticsEvent.aggregate([
      { $match: { eventType: "orchestration.completed" } },
      { $group: { _id: "$metadata.provider", count: { $sum: 1 }, avgLatencyMs: { $avg: "$metadata.providerLatencyMs" } } },
      { $project: { provider: "$_id", count: 1, avgLatencyMs: 1, _id: 0 } },
    ]),
    AnalyticsEvent.countDocuments({ eventType: "side_effect.query" }),
    AnalyticsEvent.countDocuments({ eventType: "llm.groq.used" }),
    AnalyticsEvent.countDocuments({ eventType: "pharmacy.confidence.estimated" }),
  ]);

  return {
    topMedicines,
    topSymptoms,
    repeatSearches,
    sosTrends,
    familyProfiles,
    activePharmacies,
    geoReadyPharmacies,
    medicinesInStock,
    retrievalUsage,
    retrievalCount: retrievalUsage.reduce((sum, item) => sum + item.count, 0),
    memoryHits: retrievalUsage.filter((item) => item.type === "memory").reduce((sum, item) => sum + item.hits, 0),
    knowledgeHits: retrievalUsage.filter((item) => item.type === "knowledge").reduce((sum, item) => sum + item.hits, 0),
    vectorSearches: retrievalUsage.filter((item) => item.type === "knowledge" || item.type === "vector").reduce((sum, item) => sum + item.count, 0),
    keywordSearches: retrievalUsage.filter((item) => item.type === "keyword").reduce((sum, item) => sum + item.count, 0),
    hybridSearches: retrievalUsage.filter((item) => item.type === "hybrid").reduce((sum, item) => sum + item.count, 0),
    failedMedicineLookups,
    retrievalQuality,
    normalizationHits: medicineKnowledgeEvents
      .filter((item) => item.eventType === "medicine.knowledge.normalized")
      .reduce((sum, item) => sum + item.count, 0),
    unknownMedicineKnowledgeSearches: medicineKnowledgeEvents
      .filter((item) => item.eventType === "medicine.knowledge.unknown")
      .reduce((sum, item) => sum + item.count, 0),
    latestMedicineImport: latestImport?.metadata || null,
    latestSideEffectsEnrichment: latestSideEffectsEnrichment?.metadata || null,
    pharmacyIntelligence: {
      ...(pharmacySearchStats[0] || {
        nearbySearches: 0,
        inventoryMatches: 0,
        avgResultCount: 0,
        expandedSearches: 0,
      }),
      locationPermissionAccepted,
      pharmacyRankingUsage,
      estimatedConfidenceUsage: estimatedPharmacyConfidenceUsage,
      confidenceQuality: pharmacyConfidenceQuality[0] || { avgConfidenceQuality: 0, count: 0 },
      latestImport: latestPharmacyImport?.metadata || null,
    },
    orchestration: orchestrationStats[0] || {
      workflows: 0,
      failedWorkflows: 0,
      avgToolCount: 0,
      avgEvidenceSize: 0,
      avgProviderLatencyMs: 0,
      avgOrchestrationLatencyMs: 0,
    },
    providerStats,
    sideEffectQueries,
    groqUsage,
  };
};

module.exports = {
  getAnalyticsSummary,
};
