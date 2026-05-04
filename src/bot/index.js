const { Bot, GrammyError, HttpError } = require("grammy");
const { handleSearch } = require("./commands/search");
const { handleSos, handleSosStep, isInSosFlow } = require("./commands/sos");
const { handleNearby, handleAreaSelection, handleAreas, handleLocation } = require("./commands/nearby");
const {
  handleFamily,
  handleAddMember,
  handleMembers,
  handleRemoveMember,
  handlePendingFamilyText,
} = require("./commands/family");
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
const { setLanguage } = require("../services/familyService");
const logger = require("../utils/logger");

const createBot = () => {
  const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

  // ── Global Middleware ─────────────────────────────────────────────────────
  bot.use(rateLimiter);

  // ── Basic Commands ────────────────────────────────────────────────────────
  bot.command("start", async (ctx) => {
    await ctx.reply(formatWelcome(ctx.from?.first_name), {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "English", callback_data: "onboard:lang:english" },
            { text: "Hinglish", callback_data: "onboard:lang:hinglish" },
            { text: "हिंदी", callback_data: "onboard:lang:hindi" },
          ],
          [
            { text: "👨‍👩‍👧 Add Family", callback_data: "family:add" },
            { text: "🔍 Search Medicine", callback_data: "prompt_search" },
          ],
        ],
      },
    });
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(formatHelp(), { parse_mode: "HTML" });
  });

  bot.command("about", async (ctx) => {
    await ctx.reply(
      `🏥 <b>MediFast AI</b>\n\n` +
        `India-first medicine assistant for Telegram and WhatsApp-ready workflows.\n\n` +
        `📊 Live pharmacy inventory foundation for Jaipur.\n` +
        `⚡ Hindi, Hinglish, typo-tolerant medicine search.\n` +
        `👨‍👩‍👧 Family profiles and refill history.\n` +
        `📍 Nearby pharmacy architecture ready for maps and live stock.\n` +
        `🆘 SOS feature for rare medicines.\n\n` +
        `<i>This bot helps discover medicines and is not a replacement for a doctor.</i>`,
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

  // ── Family Profiles ──────────────────────────────────────────────────────
  bot.command("family", handleFamily);
  bot.command("addmember", async (ctx) => {
    await handleAddMember(ctx, ctx.match?.trim());
  });
  bot.command("members", handleMembers);
  bot.command("removeMember", async (ctx) => {
    await handleRemoveMember(ctx, ctx.match?.trim());
  });

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

  bot.callbackQuery(/^onboard:lang:(english|hinglish|hindi)$/, async (ctx) => {
    const language = ctx.match[1];
    await setLanguage(ctx.from, language);
    await ctx.answerCallbackQuery("Saved");
    await ctx.reply(
      `✅ Language saved: ${language}\n\nWould you like to add a guardian/family member for medicine tracking?`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "➕ Add Family Member", callback_data: "family:add" },
            { text: "⏭ Skip", callback_data: "prompt_search" },
          ]],
        },
      }
    );
  });

  bot.callbackQuery("family:open", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleFamily(ctx);
  });

  bot.callbackQuery("family:add", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleAddMember(ctx);
  });

  bot.callbackQuery("family:members", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleMembers(ctx);
  });

  bot.callbackQuery("nearby:open", async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleNearby(ctx);
  });

  bot.callbackQuery(/^search_intent:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleSearch(ctx, ctx.match[1]);
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

    if (await handlePendingFamilyText(ctx)) return;

    // Otherwise, treat the message as a medicine search
    logger.debug(`Plain text search from ${ctx.from.id}: "${text}"`);
    await handleSearch(ctx, text);
  });

  bot.on("message:location", handleLocation);

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
