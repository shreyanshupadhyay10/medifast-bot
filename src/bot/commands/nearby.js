const Pharmacy = require("../../models/Pharmacy");
const Inventory = require("../../models/Inventory");
const { getNearbyPharmacyReadiness } = require("../../services/nearbyPharmacyService");
const { escapeHtml } = require("../../utils/formatter");
const logger = require("../../utils/logger");

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
      reply_markup: {
        keyboard: [[{ text: "📍 Share Location", request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
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
    const readiness = await getNearbyPharmacyReadiness({
      latitude: location.latitude,
      longitude: location.longitude,
    });

    await ctx.reply(
      `📍 <b>${escapeHtml(readiness.message)}</b>\n\n` +
        `We received your location and the architecture is ready for Google Maps, pharmacy APIs, and live stock integrations.\n\n` +
        `Active pharmacies tracked: <b>${readiness.activePharmacies}</b>\n` +
        `Geo-ready pharmacies: <b>${readiness.geoIndexedPharmacies}</b>\n\n` +
        `<i>For now, use /nearby to browse by area or type a medicine name to search stock.</i>`,
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

/**
 * Show pharmacies in a selected area.
 */
const handleAreaSelection = async (ctx, area) => {
  await ctx.replyWithChatAction("typing");

  try {
    const pharmacies = await Pharmacy.find({
      area: { $regex: area, $options: "i" },
      isActive: true,
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

module.exports = { handleNearby, handleAreaSelection, handleAreas, handleLocation, JAIPUR_AREAS };
