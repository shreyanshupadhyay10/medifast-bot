const { searchMedicine } = require("../../services/searchService");
const {
  formatSearchResults,
  formatNotFound,
} = require("../../utils/formatter");
const logger = require("../../utils/logger");

/**
 * Handles /search <medicine> command and plain text messages.
 * @param {import("grammy").Context} ctx
 * @param {string} query - the medicine name to search
 */
const handleSearch = async (ctx, query) => {
  if (!query || query.trim().length < 2) {
    return ctx.reply(
      "Please provide a medicine name.\nExample: /search Paracetamol",
      { parse_mode: "HTML" }
    );
  }

  // Show typing indicator
  await ctx.replyWithChatAction("typing");

  try {
    const { results, sos, query: normalizedQuery } = await searchMedicine(query);

    if (results.length === 0) {
      if (sos) {
        // Prompt user to use SOS
        await ctx.reply(formatNotFound(normalizedQuery), {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🆘 Raise SOS Alert",
                  callback_data: `sos:${normalizedQuery.substring(0, 50)}`,
                },
              ],
              [
                {
                  text: "🔄 Try Different Spelling",
                  callback_data: "prompt_search",
                },
              ],
            ],
          },
        });
      } else {
        await ctx.reply(formatNotFound(normalizedQuery), { parse_mode: "HTML" });
      }
      return;
    }

    await ctx.reply(formatSearchResults(results, normalizedQuery), {
      parse_mode: "HTML",
    });

    logger.info(
      `Search: "${normalizedQuery}" → ${results.length} results for user ${ctx.from.id}`
    );
  } catch (error) {
    logger.error(`Search handler error: ${error.message}`);
    await ctx.reply(
      "⚠️ Something went wrong while searching. Please try again in a moment."
    );
  }
};

module.exports = { handleSearch };
