const { Bot, GrammyError, HttpError } = require("grammy");
const { handleSearch } = require("./commands/search");
const { handleSos, handleSosStep, isInSosFlow } = require("./commands/sos");
const { handleNearby, handleAreaSelection, handleAreas } = require("./commands/nearby");
const {
  handleAdminMenu,
  handleAddPharmacy,
  handleAddMedicine,
  handleUpdateStock,
  handleOpenSos,
  handleStats,
} = require("./commands/admin");
const { isAdmin } = require("./middleware/adminGuard");
const { rateLimiter } = require("./middleware/rateLimiter");
const { formatWelcome, formatHelp } = require("../utils/formatter");
const logger = require("../utils/logger");

const createBot = () => {
  const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

  // ── Global Middleware ─────────────────────────────────────────────────────
  bot.use(rateLimiter);

  // ── Basic Commands ────────────────────────────────────────────────────────
  bot.command("start", async (ctx) => {
    await ctx.reply(formatWelcome(ctx.from?.first_name), {
      parse_mode: "HTML",
    });
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(formatHelp(), { parse_mode: "HTML" });
  });

  bot.command("about", async (ctx) => {
    await ctx.reply(
      `🏥 <b>Jaipur Pharmacy Bot</b> v1.0\n\n` +
        `Built for Jaipur citizens to quickly find medicine availability.\n\n` +
        `📊 Covers pharmacies across major areas in Jaipur.\n` +
        `⚡ Fuzzy search — typos are okay!\n` +
        `🆘 SOS feature for rare medicines.\n\n` +
        `Built with ❤️ during a hackathon.`,
      { parse_mode: "HTML" }
    );
  });

  bot.command("feedback", async (ctx) => {
    await ctx.reply(
      `📝 <b>Send Feedback</b>\n\n` +
        `Reply to this message with your feedback, suggestions, or pharmacy to add.\n\n` +
        `<i>Your message will be forwarded to the admin team.</i>`,
      { parse_mode: "HTML" }
    );
  });

  // ── Search Command ────────────────────────────────────────────────────────
  bot.command("search", async (ctx) => {
    const query = ctx.match?.trim();
    await handleSearch(ctx, query);
  });

  // ── SOS Command ───────────────────────────────────────────────────────────
  bot.command("sos", async (ctx) => {
    const medicineName = ctx.match?.trim();
    await handleSos(ctx, medicineName);
  });

  // ── Nearby / Areas ────────────────────────────────────────────────────────
  bot.command("nearby", handleNearby);
  bot.command("areas", handleAreas);

  // ── Admin Commands ────────────────────────────────────────────────────────
  bot.command("admin", isAdmin, handleAdminMenu);

  bot.command("addpharmacy", isAdmin, async (ctx) => {
    await handleAddPharmacy(ctx, ctx.match?.trim());
  });

  bot.command("addmedicine", isAdmin, async (ctx) => {
    await handleAddMedicine(ctx, ctx.match?.trim());
  });

  bot.command("updatestock", isAdmin, async (ctx) => {
    await handleUpdateStock(ctx, ctx.match?.trim());
  });

  bot.command("opensos", isAdmin, handleOpenSos);
  bot.command("stats", isAdmin, handleStats);

  // ── Inline Button Callbacks ───────────────────────────────────────────────
  bot.callbackQuery(/^sos:(.+)$/, async (ctx) => {
    const medicineName = ctx.match[1];
    await ctx.answerCallbackQuery();
    await handleSos(ctx, medicineName);
  });

  bot.callbackQuery("prompt_search", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      "🔍 Type the medicine name to search again. Try alternative spellings or the generic name."
    );
  });

  bot.callbackQuery(/^area:(.+)$/, async (ctx) => {
    const area = ctx.match[1];
    await ctx.answerCallbackQuery();
    await handleAreaSelection(ctx, area);
  });

  // ── Plain Text Handler ────────────────────────────────────────────────────
  // Intercept multi-step flows first, then treat any text as a search query
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;

    // Skip if it looks like a command
    if (text.startsWith("/")) return;

    // Check if user is in the SOS flow
    if (isInSosFlow(ctx.from.id)) {
      const handled = await handleSosStep(ctx);
      if (handled) return;
    }

    // Otherwise, treat the message as a medicine search
    logger.debug(`Plain text search from ${ctx.from.id}: "${text}"`);
    await handleSearch(ctx, text);
  });

  // ── Error Handler ─────────────────────────────────────────────────────────
  bot.catch((err) => {
    const ctx = err.ctx;
    logger.error(`Bot error for update ${ctx.update.update_id}:`);

    if (err.error instanceof GrammyError) {
      logger.error(`Grammy error: ${err.error.description}`);
    } else if (err.error instanceof HttpError) {
      logger.error(`HTTP error: ${err.error.message}`);
    } else {
      logger.error(err.error);
    }
  });

  return bot;
};

module.exports = { createBot };
