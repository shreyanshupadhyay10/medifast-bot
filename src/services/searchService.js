const Fuse = require("fuse.js");
const Inventory = require("../models/Inventory");
const SosRequest = require("../models/SosRequest");
const logger = require("../utils/logger");

// Fuse.js configuration for fuzzy medicine name search
const FUSE_OPTIONS = {
  keys: [
    { name: "medicineName", weight: 0.6 },
    { name: "genericName", weight: 0.25 },
    { name: "brand", weight: 0.15 },
  ],
  threshold: 0.4,       // 0 = perfect match, 1 = match anything
  distance: 100,
  includeScore: true,
  minMatchCharLength: 3,
  shouldSort: true,
  ignoreLocation: true,
};

/**
 * Search for medicines across all pharmacies.
 * Returns results sorted by: in-stock first, then best fuzzy match.
 */
const searchMedicine = async (query) => {
  if (!query || query.trim().length < 2) {
    return { results: [], sos: false, query };
  }

  const trimmedQuery = query.trim();

  // Fetch all inventory items with pharmacy details
  // For scale, add a pre-filter using MongoDB text index first
  const allInventory = await Inventory.find({ inStock: true })
    .populate("pharmacy", "name area address contact openingHours is24x7 isActive")
    .lean();

  // Filter out entries where pharmacy is inactive
  const activeInventory = allInventory.filter(
    (item) => item.pharmacy && item.pharmacy.isActive
  );

  if (activeInventory.length === 0) {
    return { results: [], sos: false, query: trimmedQuery };
  }

  // Run Fuse.js fuzzy search
  const fuse = new Fuse(activeInventory, FUSE_OPTIONS);
  const fuseResults = fuse.search(trimmedQuery);

  if (fuseResults.length === 0) {
    // No match found — check if this is a known rare medicine
    const rareMatch = await Inventory.findOne({
      isRare: true,
      medicineNameLower: { $regex: trimmedQuery.toLowerCase(), $options: "i" },
    });

    return {
      results: [],
      sos: true, // trigger SOS flow
      isRare: !!rareMatch,
      query: trimmedQuery,
    };
  }

  // Map to clean result objects
  const results = fuseResults.map(({ item, score }) => ({
    id: item._id.toString(),
    medicineName: item.medicineName,
    genericName: item.genericName || null,
    brand: item.brand || null,
    price: item.price || null,
    unit: item.unit,
    inStock: item.inStock,
    quantity: item.quantity,
    requiresPrescription: item.requiresPrescription,
    isRare: item.isRare,
    category: item.category,
    lastVerified: item.lastVerified,
    matchScore: score,
    pharmacy: {
      id: item.pharmacy._id.toString(),
      name: item.pharmacy.name,
      area: item.pharmacy.area,
      address: item.pharmacy.address,
      phone: item.pharmacy.contact?.phone || null,
      whatsapp: item.pharmacy.contact?.whatsapp || null,
      hours: item.pharmacy.is24x7 ? "Open 24×7" : item.pharmacy.openingHours,
    },
  }));

  // Check if any result is a rare medicine
  const hasRare = results.some((r) => r.isRare);

  return {
    results,
    sos: results.length === 0,
    hasRare,
    query: trimmedQuery,
  };
};

/**
 * Search across ALL inventory (in-stock + out-of-stock) for admin use.
 */
const searchMedicineFull = async (query) => {
  const allInventory = await Inventory.find()
    .populate("pharmacy", "name area address contact openingHours is24x7")
    .lean();

  const fuse = new Fuse(allInventory, FUSE_OPTIONS);
  return fuse.search(query).map(({ item }) => item);
};

/**
 * Create an SOS request and log it.
 */
const createSosRequest = async ({ medicineName, telegramId, username, firstName, area, contact }) => {
  try {
    // Avoid duplicate open SOS for same medicine from same user
    const existing = await SosRequest.findOne({
      medicineName: { $regex: medicineName, $options: "i" },
      "requestedBy.telegramId": String(telegramId),
      status: "open",
    });

    if (existing) {
      return { created: false, request: existing };
    }

    const request = await SosRequest.create({
      medicineName,
      requestedBy: { telegramId: String(telegramId), username, firstName },
      area,
      contact,
    });

    return { created: true, request };
  } catch (error) {
    logger.error(`SOS creation error: ${error.message}`);
    throw error;
  }
};

/**
 * Get all open SOS requests (for admin).
 */
const getOpenSosRequests = async () => {
  return SosRequest.find({ status: "open" }).sort({ createdAt: -1 }).lean();
};

module.exports = {
  searchMedicine,
  searchMedicineFull,
  createSosRequest,
  getOpenSosRequests,
};
