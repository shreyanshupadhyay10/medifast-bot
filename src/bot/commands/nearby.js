const Pharmacy = require("../../models/Pharmacy");
const Inventory = require("../../models/Inventory");
const { getNearbyPharmacyReadiness } = require("../../services/nearbyPharmacyService");
const { recommendNearbyPharmacies } = require("../../pharmacy/pharmacyRecommendationService");
const { saveSessionLocation, shareLocationKeyboard } = require("../../pharmacy/pharmacyLocationService");
const eventBus = require("../../events/eventBus");
const { escapeHtml } = require("../../utils/formatter");
const logger = require("../../utils/logger");

const realPharmacyDataExists = async () =>
  Pharmacy.exists({ isActive: true, source: { $ne: "manual" }, "location.coordinates.0": { $exists: true } });

// Jaipur areas we cover
const JAIPUR_AREAS = [
  "Mansarovar",
  "Vaishali Nagar",
  "Malviya Nagar",
  "C-Scheme",
  "Tonk Road",
  "Ajmer Road",
  "Raja Park",
  "Sodala",
  "Pratap Nagar",
  "Jagatpura",
  "Sanganer",
  "Sitapura",
  "Jhotwara",
  "Shyam Nagar",
  "Nirman Nagar",
];

/**
 * Show list of areas as inline keyboard.
 */
const handleNearby = async (ctx) => {
  const buttons = JAIPUR_AREAS.map((area) => [
    {
      text: `📍 ${area}`,
      callback_data: `area:${area}`,
    },
  ]);

  await ctx.reply(
    "📍 <b>Nearby Pharmacies</b>\n\nShare location for live nearby matching, or browse by Jaipur area:",
    {
      parse_mode: "HTML",
      reply_markup: shareLocationKeyboard(),
    }
  );

  await ctx.reply("Or select your locality:", {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons },
  });
};

const handleLocation = async (ctx) => {
  const location = ctx.message.location;
  if (!location) return;

  try {
    await saveSessionLocation({
      telegramId: ctx.from?.id,
      latitude: location.latitude,
      longitude: location.longitude,
      persistHome: true,
    });
    eventBus.emitSafe("location.permission.accepted", {
      telegramId: ctx.from?.id,
    });
    const recommendation = await recommendNearbyPharmacies({
      telegramId: ctx.from?.id,
      latitude: location.latitude,
      longitude: location.longitude,
    });
    const readiness = await getNearbyPharmacyReadiness({
      latitude: location.latitude,
      longitude: location.longitude,
    });
    eventBus.emitSafe("nearby.completed", {
      telegramId: ctx.from?.id,
      resultCount: recommendation.ranked?.length || 0,
      radiusKm: recommendation.radiusKm,
    });

    const nearbyList = recommendation.ranked?.length
      ? recommendation.ranked
          .map((pharmacy, index) => {
            const phone = pharmacy.phone ? `\n   📞 ${escapeHtml(pharmacy.phone)}` : "";
            return `${index + 1}. <b>${escapeHtml(pharmacy.name)}</b>\n   📍 ${escapeHtml(pharmacy.address)}\n   Distance: <b>${escapeHtml(pharmacy.distance)}</b> · Score: <b>${pharmacy.score}</b>${phone}`;
          })
          .join("\n\n")
      : "No nearby pharmacies found for this location.";

    await ctx.reply(
      `📍 <b>${escapeHtml(recommendation.ranked?.length ? `Found ${recommendation.ranked.length} pharmacy option(s) within ${recommendation.radiusKm} km.` : readiness.message)}</b>\n\n` +
        `${nearbyList}\n\n` +
        `Active pharmacies tracked: <b>${readiness.activePharmacies}</b>\n` +
        `Geo-ready pharmacies: <b>${readiness.geoIndexedPharmacies}</b>\n` +
        `Search radius: <b>${recommendation.radiusKm} km</b>\n\n` +
        `<i>Type a medicine name with “near me”, like: Dolo near me.</i>`,
      {
        parse_mode: "HTML",
        reply_markup: { remove_keyboard: true },
      }
    );
  } catch (error) {
    logger.error(`Location nearby error: ${error.message}`);
    await ctx.reply("Could not process your location right now. Please try /nearby by area.");
  }
};

const formatNearbyRecommendations = (recommendation, medicineQuery = "") => {
  const medicineLine = medicineQuery
    ? `Medicine: <b>${escapeHtml(recommendation.medicine?.genericName || medicineQuery)}</b>\n`
    : "";
  if (!recommendation.ranked?.length) {
    return (
      `📍 <b>No nearby pharmacy matches yet</b>\n\n` +
      medicineLine +
      `We checked within <b>${recommendation.radiusKm} km</b>. Try another location or browse /nearby by area.`
    );
  }

  const rows = recommendation.ranked.slice(0, 5).map((item, index) => {
    const inventory = item.inventoryMatches?.length
      ? `\n   Inventory: ${item.inventoryMatches.slice(0, 2).map((match) => escapeHtml(match.medicineName)).join(", ")}`
      : "\n   Inventory: call to confirm";
    const phone = item.phone ? `\n   📞 ${escapeHtml(item.phone)}` : "";
    return (
      `${index + 1}. <b>${escapeHtml(item.name)}</b>\n` +
      `   Distance: <b>${escapeHtml(item.distance)}</b> · Score: <b>${item.score}</b>\n` +
      `   Stock confidence: <b>${Math.round(item.inventoryConfidence * 100)}%</b>${inventory}${phone}\n` +
      `   📍 ${escapeHtml(item.address)}`
    );
  });

  return (
    `📍 <b>Nearby Pharmacy Matches</b>\n` +
    medicineLine +
    `Search radius: <b>${recommendation.radiusKm} km</b>${recommendation.expandedRadius ? " (expanded)" : ""}\n\n` +
    `${rows.join("\n\n")}\n\n` +
    `<i>Stock info may change. Call ahead to confirm.</i>`
  );
};

const handleNearbyMedicineSearch = async (ctx, { latitude, longitude, medicineQuery }) => {
  const recommendation = await recommendNearbyPharmacies({
    telegramId: ctx.from?.id,
    latitude,
    longitude,
    medicineQuery,
  });
  await ctx.reply(formatNearbyRecommendations(recommendation, medicineQuery), {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "🔄 Search Again", callback_data: "prompt_search" }]],
    },
  });
  return recommendation;
};

/**
 * Show pharmacies in a selected area.
 */
const handleAreaSelection = async (ctx, area) => {
  await ctx.replyWithChatAction("typing");

  try {
    const useRealDataOnly = await realPharmacyDataExists();
    const pharmacies = await Pharmacy.find({
      area: { $regex: area, $options: "i" },
      isActive: true,
      ...(useRealDataOnly ? { source: { $ne: "manual" } } : {}),
    }).lean();

    if (pharmacies.length === 0) {
      return ctx.editMessageText(
        `😔 No pharmacies found in <b>${escapeHtml(area)}</b> yet.\n\n` +
          `We're expanding! Use /feedback to suggest pharmacies to add.`,
        { parse_mode: "HTML" }
      );
    }

    let message = `🏪 <b>Pharmacies in ${escapeHtml(area)}</b>\n\n`;

    for (const pharmacy of pharmacies) {
      // Count medicines in stock at this pharmacy
      const stockCount = await Inventory.countDocuments({
        pharmacy: pharmacy._id,
        inStock: true,
      });

      message += `<b>${escapeHtml(pharmacy.name)}</b>\n`;
      message += `📍 ${escapeHtml(pharmacy.address)}\n`;
      if (pharmacy.contact?.phone) {
        message += `📞 ${escapeHtml(pharmacy.contact.phone)}\n`;
      }
      message += `🕐 ${pharmacy.is24x7 ? "Open 24×7" : escapeHtml(pharmacy.openingHours)}\n`;
      message += `💊 ${stockCount} medicines tracked\n\n`;
    }

    message += `<i>Type a medicine name to check availability at these pharmacies.</i>`;

    await ctx.editMessageText(message, { parse_mode: "HTML" });
  } catch (error) {
    logger.error(`Area selection error: ${error.message}`);
    await ctx.reply("⚠️ Could not load pharmacies. Please try again.");
  }
};

/**
 * Handle /areas command — list all covered areas.
 */
const handleAreas = async (ctx) => {
  const areaList = JAIPUR_AREAS.map((a) => `• ${a}`).join("\n");
  await ctx.reply(
    `📍 <b>Areas covered in Jaipur:</b>\n\n${areaList}\n\n` +
      `Use /nearby to browse pharmacies by area.`,
    { parse_mode: "HTML" }
  );
};

module.exports = {
  formatNearbyRecommendations,
  handleNearby,
  handleNearbyMedicineSearch,
  handleAreaSelection,
  handleAreas,
  handleLocation,
  JAIPUR_AREAS,
};
