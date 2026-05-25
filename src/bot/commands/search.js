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
const { runMediFastWorkflow } = require("../../orchestrator/orchestrator");
const eventBus = require("../../events/eventBus");
const {
  formatSearchResults,
  formatNotFound,
  formatReorderPrompt,
  formatSearchFollowUp,
  buildSearchActionKeyboard,
  formatMemorySaved,
} = require("../../utils/formatter");
const logger = require("../../utils/logger");

const isGreeting = (text = "") =>
  /^(hi|hello|hey|namaste|namaskar|ji|haan|han|yes|yo|hii|helo)$/i.test(String(text).trim());

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

  if (isGreeting(query)) {
    return ctx.reply(
      "Hi, I am MediFast AI. Send a medicine name like <code>Dolo 650</code>, a symptom like <code>bukhar ki tablet</code>, or use /nearby to find pharmacies.",
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
    const familyTarget = mentionedMember || (entities.person && entities.person !== "self"
      ? { name: entities.familyMemberName || entities.person, relation: entities.person, ageGroup: "adult" }
      : null);
    const safety = assessSafety({ entities, intent, mentionedMember, query });
    const userLocation = await getSessionLocation(ctx.from.id);
    if (entities.intentType === "side_effects") {
      eventBus.emitSafe("side_effect.query", {
        telegramId: ctx.from.id,
        query,
        medicine: entities.medicine,
      });
    }

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

    const genericFamilyMedicineAsk = /\b(medicine|tablet|dawa|goli|meds?)\b/i.test(query) && familyTarget && !entities.symptom && !entities.medicine;
    if (genericFamilyMedicineAsk) {
      const recent = await getRecentForFamilyMember(ctx.from.id, familyTarget.name);
      await addConversationTurn({ telegramId: ctx.from.id, userText: query, entities });
      return ctx.reply(formatReorderPrompt(familyTarget, recent), {
        parse_mode: "HTML",
        reply_markup: recent?.topMedicineName
          ? {
              inline_keyboard: [
                [{ text: "🔍 Check Availability", callback_data: `search_intent:${recent.topMedicineName.substring(0, 50)}` }],
                [{ text: "📍 Nearby Pharmacy", callback_data: "nearby:open" }],
              ],
            }
          : undefined,
      });
    }

    if (entities.condition && familyTarget && !entities.symptom && !entities.medicine && !entities.nearbyIntent) {
      const updatedMemory = await addConversationTurn({ telegramId: ctx.from.id, userText: query, entities });
      const newFacts = (updatedMemory?.facts || []).filter((fact) =>
        fact.entity === entities.person || fact.entity === familyTarget.relation
      );
      return ctx.reply(formatMemorySaved({ member: familyTarget, facts: newFacts, query }), {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔍 Search Medicine", callback_data: "prompt_search" }],
            [{ text: "👨‍👩‍👧 View Family", callback_data: "family:members" }],
          ],
        },
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

    const normalizedIntentQuery = aliasExpansion.alias
      ? aliasExpansion.normalizedQuery
      : entities.medicine || intent.normalizedQuery;

    if (entities.nearbyIntent) {
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
    const { results, sos, query: normalizedQuery, suggestions = [] } = await searchMedicine(normalizedIntentQuery, searchOptions);
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
        await ctx.reply(formatNotFound(normalizedQuery, suggestions), {
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
        await ctx.reply(formatNotFound(normalizedQuery, suggestions), { parse_mode: "HTML" });
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
    const workflow = needsContext
      ? await runMediFastWorkflow({
          query,
          profile,
          telegramId: ctx.from.id,
          location: userLocation,
          intent,
          mentionedMember,
        })
      : null;
    const aiContext = needsContext
      ? {
          answer: workflow?.generated?.text || "",
          sources: workflow.knowledge?.sources || [],
          memory: workflow.memory || [],
          context: workflow.knowledge?.context || [],
          confidence: workflow.knowledge?.confidence || 0,
          lowConfidence: workflow.knowledge?.confidence ? workflow.knowledge.confidence < Number(process.env.RETRIEVAL_CONFIDENCE_THRESHOLD || 0.45) : false,
          evidence: workflow.evidence,
          toolSequence: workflow.debug?.toolSequence || [],
          providerLatencyMs: workflow.debug?.providerLatencyMs || 0,
          status: "orchestrated",
        }
      : null;

    await ctx.reply(formatSearchResults(results, normalizedQuery, { intent, mentionedMember, repeatSearch, routes, safety, alias: aliasExpansion.alias, aiContext, entities }), {
      parse_mode: "HTML",
      reply_markup: buildSearchActionKeyboard(normalizedQuery),
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
