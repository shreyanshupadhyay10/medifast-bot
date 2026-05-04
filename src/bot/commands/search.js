const { searchMedicine } = require("../../services/searchService");
const { detectIntent } = require("../../services/intentEngine");
const { findMentionedFamilyMember, getOrCreateProfile } = require("../../services/familyService");
const { getRecentForFamilyMember, getRecentRepeat, recordSearch } = require("../../services/historyService");
const { expandMedicineAliases } = require("../../services/medicineAliasService");
const {
  formatSearchResults,
  formatNotFound,
  formatReorderPrompt,
  formatSearchFollowUp,
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
    const profile = await getOrCreateProfile(ctx.from);
    const intent = detectIntent(query);
    const mentionedMember = findMentionedFamilyMember(profile, query);

    if (/\b(reorder|repeat|refill|phir se|dobara)\b/i.test(query) && mentionedMember) {
      const recent = await getRecentForFamilyMember(ctx.from.id, mentionedMember.name);
      return ctx.reply(formatReorderPrompt(mentionedMember, recent), {
        parse_mode: "HTML",
        reply_markup: recent?.topMedicineName
          ? {
              inline_keyboard: [
                [
                  {
                    text: "🔍 Check Availability",
                    callback_data: `search_intent:${recent.topMedicineName.substring(0, 50)}`,
                  },
                ],
                [{ text: "📍 Nearby Pharmacy", callback_data: "nearby:open" }],
              ],
            }
          : undefined,
      });
    }

    if (intent.needsFollowUp) {
      return ctx.reply(formatSearchFollowUp(query), {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Fever", callback_data: "search_intent:fever" },
              { text: "Cough", callback_data: "search_intent:cough" },
              { text: "Acidity", callback_data: "search_intent:acidity" },
            ],
          ],
        },
      });
    }

    const repeatSearch = await getRecentRepeat(ctx.from.id, intent.normalizedQuery);
    const aliasTerms = expandMedicineAliases(intent.normalizedQuery);
    const { results, sos, query: normalizedQuery } = await searchMedicine(intent.normalizedQuery, { ...intent, searchTerms: aliasTerms });

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
              [{ text: "🔄 Search Again", callback_data: "prompt_search" }],
              [{ text: "📍 Nearby Pharmacy", callback_data: "nearby:open" }],
            ],
          },
        });
      } else {
        await ctx.reply(formatNotFound(normalizedQuery), { parse_mode: "HTML" });
      }
      return;
    }

    await recordSearch({
      telegramId: ctx.from.id,
      originalQuery: query,
      normalizedQuery,
      intentKey: intent.key,
      topMedicineName: results[0]?.medicineName,
      familyMemberName: mentionedMember?.name,
    });

    await ctx.reply(formatSearchResults(results, normalizedQuery, { intent, mentionedMember, repeatSearch }), {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔄 Search Again", callback_data: "prompt_search" },
            { text: "📍 Nearby Pharmacy", callback_data: "nearby:open" },
          ],
          [
            { text: "👨‍👩‍👧 Family", callback_data: "family:open" },
            { text: "🆘 SOS", callback_data: `sos:${normalizedQuery.substring(0, 50)}` },
          ],
        ],
      },
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
