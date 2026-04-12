const Pharmacy = require("../../models/Pharmacy");
const Inventory = require("../../models/Inventory");
const SosRequest = require("../../models/SosRequest");
const { getOpenSosRequests } = require("../../services/searchService");
const { escapeHtml } = require("../../utils/formatter");
const logger = require("../../utils/logger");

/**
 * /admin — Show admin menu.
 */
const handleAdminMenu = async (ctx) => {
  await ctx.reply(
    `🔧 <b>Admin Panel</b>\n\n` +
      `<b>Pharmacy Management:</b>\n` +
      `/addpharmacy — Add a new pharmacy\n\n` +
      `<b>Inventory Management:</b>\n` +
      `/addmedicine — Add medicine to a pharmacy\n` +
      `/updatestock — Update medicine stock status\n\n` +
      `<b>SOS Management:</b>\n` +
      `/opensos — View all open SOS requests\n` +
      `/closesos &lt;id&gt; — Close an SOS request\n\n` +
      `<b>Stats:</b>\n` +
      `/stats — Database statistics`,
    { parse_mode: "HTML" }
  );
};

/**
 * /addpharmacy name|area|address|phone|hours
 * Example: /addpharmacy Sharma Medicals|Mansarovar|A-12 Mansarovar|9876543210|9AM-9PM
 */
const handleAddPharmacy = async (ctx, args) => {
  if (!args) {
    return ctx.reply(
      "Usage: /addpharmacy <b>name|area|address|phone|hours</b>\n\n" +
        "Example:\n<code>/addpharmacy Sharma Medicals|Mansarovar|A-12 Mansarovar Jaipur|9876543210|9AM-10PM</code>",
      { parse_mode: "HTML" }
    );
  }

  const parts = args.split("|").map((p) => p.trim());
  if (parts.length < 3) {
    return ctx.reply(
      "⚠️ Please provide at least: name|area|address\n" +
        "Optional: phone and hours separated by |"
    );
  }

  const [name, area, address, phone, hours] = parts;

  try {
    const existing = await Pharmacy.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
      area: { $regex: `^${area}$`, $options: "i" },
    });

    if (existing) {
      return ctx.reply(
        `⚠️ Pharmacy "<b>${escapeHtml(name)}</b>" in ${escapeHtml(area)} already exists.\nID: <code>${existing._id}</code>`,
        { parse_mode: "HTML" }
      );
    }

    const pharmacy = await Pharmacy.create({
      name,
      area,
      address,
      contact: { phone: phone || null },
      openingHours: hours || "9:00 AM – 10:00 PM",
    });

    logger.info(`Admin added pharmacy: ${name} (${pharmacy._id})`);
    await ctx.reply(
      `✅ <b>Pharmacy added!</b>\n\n` +
        `Name: ${escapeHtml(pharmacy.name)}\n` +
        `Area: ${escapeHtml(pharmacy.area)}\n` +
        `ID: <code>${pharmacy._id}</code>`,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    logger.error(`Add pharmacy error: ${error.message}`);
    await ctx.reply(`⚠️ Error: ${error.message}`);
  }
};

/**
 * /addmedicine pharmacyId|medicineName|price|inStock|generic|category
 * Example: /addmedicine 60f...abc|Metformin 500mg|45|true|Metformin|antidiabetic
 */
const handleAddMedicine = async (ctx, args) => {
  if (!args) {
    return ctx.reply(
      "Usage: /addmedicine <b>pharmacyId|medicineName|price|inStock|generic|category</b>\n\n" +
        "Example:\n<code>/addmedicine 60fabc123|Metformin 500mg|45|true|Metformin|antidiabetic</code>\n\n" +
        "inStock: true/false\nCategories: antibiotic, painkiller, antidiabetic, cardiac, gastro, respiratory, vitamins, rare, other",
      { parse_mode: "HTML" }
    );
  }

  const parts = args.split("|").map((p) => p.trim());
  if (parts.length < 2) {
    return ctx.reply("⚠️ At minimum, provide: pharmacyId|medicineName");
  }

  const [pharmacyId, medicineName, price, inStock, genericName, category] = parts;

  try {
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) {
      return ctx.reply(`⚠️ No pharmacy found with ID: <code>${escapeHtml(pharmacyId)}</code>`, {
        parse_mode: "HTML",
      });
    }

    const inventory = await Inventory.findOneAndUpdate(
      { medicineName: new RegExp(`^${medicineName}$`, "i"), pharmacy: pharmacyId },
      {
        medicineName,
        medicineNameLower: medicineName.toLowerCase(),
        genericName: genericName || undefined,
        category: category || "other",
        price: price ? parseFloat(price) : undefined,
        inStock: inStock !== "false",
        pharmacy: pharmacyId,
        lastVerified: new Date(),
      },
      { upsert: true, new: true, runValidators: true }
    );

    logger.info(`Admin added medicine: ${medicineName} at ${pharmacy.name}`);
    await ctx.reply(
      `✅ <b>Medicine ${inventory.isNew ? "added" : "updated"}!</b>\n\n` +
        `Medicine: ${escapeHtml(medicineName)}\n` +
        `Pharmacy: ${escapeHtml(pharmacy.name)}\n` +
        `Price: ₹${price || "N/A"}\n` +
        `In Stock: ${inStock !== "false" ? "Yes ✅" : "No ❌"}`,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    logger.error(`Add medicine error: ${error.message}`);
    await ctx.reply(`⚠️ Error: ${error.message}`);
  }
};

/**
 * /updatestock pharmacyId|medicineName|true/false
 */
const handleUpdateStock = async (ctx, args) => {
  if (!args) {
    return ctx.reply(
      "Usage: /updatestock <b>pharmacyId|medicineName|true/false</b>",
      { parse_mode: "HTML" }
    );
  }

  const [pharmacyId, medicineName, stockStatus] = args.split("|").map((p) => p.trim());
  const inStock = stockStatus !== "false";

  try {
    const updated = await Inventory.findOneAndUpdate(
      {
        pharmacy: pharmacyId,
        medicineName: { $regex: new RegExp(`^${medicineName}$`, "i") },
      },
      { inStock, lastVerified: new Date() },
      { new: true }
    );

    if (!updated) {
      return ctx.reply(`⚠️ Medicine not found. Use /addmedicine to add it first.`);
    }

    await ctx.reply(
      `✅ Stock updated!\n${escapeHtml(medicineName)}: ${inStock ? "In Stock ✅" : "Out of Stock ❌"}`,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    logger.error(`Update stock error: ${error.message}`);
    await ctx.reply(`⚠️ Error: ${error.message}`);
  }
};

/**
 * /opensos — View open SOS requests.
 */
const handleOpenSos = async (ctx) => {
  try {
    const requests = await getOpenSosRequests();

    if (requests.length === 0) {
      return ctx.reply("✅ No open SOS requests currently.");
    }

    let message = `🆘 <b>Open SOS Requests (${requests.length})</b>\n\n`;
    requests.slice(0, 10).forEach((req, i) => {
      message += `${i + 1}. <b>${escapeHtml(req.medicineName)}</b>\n`;
      message += `   Area: ${escapeHtml(req.area || "Not specified")}\n`;
      message += `   By: @${escapeHtml(req.requestedBy.username || "anonymous")}\n`;
      message += `   ID: <code>${req._id}</code>\n`;
      message += `   Created: ${new Date(req.createdAt).toLocaleString("en-IN")}\n\n`;
    });

    if (requests.length > 10) {
      message += `<i>... and ${requests.length - 10} more.</i>`;
    }

    await ctx.reply(message, { parse_mode: "HTML" });
  } catch (error) {
    logger.error(`Open SOS error: ${error.message}`);
    await ctx.reply("⚠️ Could not fetch SOS requests.");
  }
};

/**
 * /stats — DB stats.
 */
const handleStats = async (ctx) => {
  try {
    const [pharmacies, medicines, inStock, openSos] = await Promise.all([
      Pharmacy.countDocuments({ isActive: true }),
      Inventory.countDocuments(),
      Inventory.countDocuments({ inStock: true }),
      SosRequest.countDocuments({ status: "open" }),
    ]);

    await ctx.reply(
      `📊 <b>Database Stats</b>\n\n` +
        `🏪 Active Pharmacies: <b>${pharmacies}</b>\n` +
        `💊 Total Medicines Tracked: <b>${medicines}</b>\n` +
        `✅ In Stock: <b>${inStock}</b>\n` +
        `❌ Out of Stock: <b>${medicines - inStock}</b>\n` +
        `🆘 Open SOS Requests: <b>${openSos}</b>`,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    logger.error(`Stats error: ${error.message}`);
    await ctx.reply("⚠️ Could not fetch stats.");
  }
};

module.exports = {
  handleAdminMenu,
  handleAddPharmacy,
  handleAddMedicine,
  handleUpdateStock,
  handleOpenSos,
  handleStats,
};
