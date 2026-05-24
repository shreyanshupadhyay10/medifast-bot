const { searchMedicine } = require("../../services/searchService");
const { detectIntent } = require("../../services/intentEngine");
const { expandMedicineQuery } = require("../../services/medicineAliasService");
const { extractEntities } = require("../../ai/entityExtractor");
const { routeMessage } = require("../../ai/router");
const { assessSafety } = require("../../ai/safetyGuard");
const { findMentionedFamilyMember, getOrCreateProfile } = require("../../services/familyService");
const { emitSearchCompleted, getRecentForFamilyMember, getRecentRepeat } = require("../../services/historyService");
const { addConversationTurn } = require("../../services/memoryService");
const { answerFromKnowledgeBase } = require("../../services/ragService");
const { getSessionLocation, shareLocationKeyboard } = require("../../pharmacy/pharmacyLocationService");
const { handleNearbyMedicineSearch } = require("./nearby");
const eventBus = require("../../events/eventBus");
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
    const entities = extractEntities(query, profile);
    const routes = routeMessage({ entities, profile });
    const aliasExpansion = expandMedicineQuery(query);
    const intent = detectIntent(aliasExpansion.alias ? aliasExpansion.normalizedQuery : query);
    const mentionedMember = findMentionedFamilyMember(profile, query);
    const safety = assessSafety({ entities, intent, mentionedMember, query });

    if (/\b(reorder|repeat|refill|phir se|dobara)\b/i.test(query) && mentionedMember) {
      const recent = await getRecentForFamilyMember(ctx.from.id, mentionedMember.name);
      await addConversationTurn({ telegramId: ctx.from.id, userText: query, entities });
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
      await addConversationTurn({ telegramId: ctx.from.id, userText: query, entities });
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

    const normalizedIntentQuery = aliasExpansion.alias ? aliasExpansion.normalizedQuery : intent.normalizedQuery;

    if (entities.nearbyIntent) {
      const userLocation = await getSessionLocation(ctx.from.id);
      await addConversationTurn({ telegramId: ctx.from.id, userText: query, entities });
      if (!userLocation) {
        return ctx.reply(
          "📍 <b>Share your location to find nearby pharmacies</b>\n\nI can search within 5 km and expand to 10 km if needed.",
          {
            parse_mode: "HTML",
            reply_markup: shareLocationKeyboard(),
          }
        );
      }
      return handleNearbyMedicineSearch(ctx, {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        medicineQuery: normalizedIntentQuery,
      });
    }

    const searchOptions = {
      ...intent,
      searchTerms: [...(intent.searchTerms || []), ...(aliasExpansion.searchTerms || [])],
      categories: [...new Set([...(intent.categories || []), ...(aliasExpansion.categories || [])])],
      alias: aliasExpansion.alias,
    };
    const repeatSearch = await getRecentRepeat(ctx.from.id, normalizedIntentQuery);
    const { results, sos, query: normalizedQuery } = await searchMedicine(normalizedIntentQuery, searchOptions);
    const memory = await addConversationTurn({ telegramId: ctx.from.id, userText: query, entities });

    if (results.length === 0) {
      eventBus.emitSafe("medicine.lookup.failed", {
        telegramId: ctx.from.id,
        query,
        normalizedQuery,
        intentKey: intent.key,
      });
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

    const historyPayload = {
      telegramId: ctx.from.id,
      originalQuery: query,
      normalizedQuery,
      intentKey: intent.key,
      topMedicineName: results[0]?.medicineName,
      familyMemberName: mentionedMember?.name,
    };
    emitSearchCompleted(historyPayload);

    if (mentionedMember?.notifyGuardian && mentionedMember.guardianTelegramId) {
      eventBus.emitSafe("guardian.alert.requested", {
        guardianTelegramId: mentionedMember.guardianTelegramId,
        message:
          `👨‍👩‍👧 <b>MediFast Family Alert</b>\n\n` +
          `${mentionedMember.name} searched for <b>${normalizedQuery}</b>.\n` +
          `This is only an informational alert, not a medical recommendation.`,
      });
    }

    const needsContext = routes.some((route) => route.tool === "rag" || route.tool === "memory");
    const aiContext = needsContext
      ? await answerFromKnowledgeBase(query, { telegramId: String(ctx.from.id), memoryId: memory?._id?.toString() })
      : null;

    await ctx.reply(formatSearchResults(results, normalizedQuery, { intent, mentionedMember, repeatSearch, routes, safety, alias: aliasExpansion.alias, aiContext, entities }), {
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
