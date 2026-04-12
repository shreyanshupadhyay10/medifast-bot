const { createSosRequest } = require("../../services/searchService");
const { formatSosConfirm, escapeHtml } = require("../../utils/formatter");
const logger = require("../../utils/logger");

// Tracks users who are awaiting SOS area/contact info
const pendingSos = new Map();

/**
 * Handles /sos <medicine> command.
 * Flow: user provides medicine name → bot asks for area → creates SOS → broadcasts to admin.
 */
const handleSos = async (ctx, medicineName) => {
  if (!medicineName || medicineName.trim().length < 2) {
    return ctx.reply(
      "Please provide the medicine name after /sos\nExample: /sos Clonazepam 2mg",
      { parse_mode: "HTML" }
    );
  }

  const trimmed = medicineName.trim();
  const userId = ctx.from.id;

  // Store pending SOS state for this user
  pendingSos.set(userId, {
    medicineName: trimmed,
    step: "ask_area",
    createdAt: Date.now(),
  });

  await ctx.reply(
    `🆘 <b>SOS for: ${escapeHtml(trimmed)}</b>\n\n` +
      `Which area of Jaipur are you in? (e.g., Mansarovar, Vaishali Nagar, Malviya Nagar)\n\n` +
      `<i>Type your area or send /skip to skip</i>`,
    { parse_mode: "HTML" }
  );
};

/**
 * Handles the follow-up area message for SOS flow.
 * Called from the main message handler when user is in SOS flow.
 */
const handleSosStep = async (ctx) => {
  const userId = ctx.from.id;
  const pending = pendingSos.get(userId);

  if (!pending) return false; // Not in SOS flow

  // Clean up expired SOS state (older than 10 minutes)
  if (Date.now() - pending.createdAt > 10 * 60 * 1000) {
    pendingSos.delete(userId);
    return false;
  }

  const text = ctx.message?.text?.trim();

  if (pending.step === "ask_area") {
    const area = text === "/skip" ? null : text;

    // Finalize the SOS request
    try {
      const { created, request } = await createSosRequest({
        medicineName: pending.medicineName,
        telegramId: userId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        area,
        contact: null,
      });

      pendingSos.delete(userId);

      if (!created) {
        await ctx.reply(
          `ℹ️ You already have an open SOS request for <b>${escapeHtml(pending.medicineName)}</b>.\n` +
            `We're still looking! You'll be notified when it's found.`,
          { parse_mode: "HTML" }
        );
        return true;
      }

      // Notify user
      await ctx.reply(formatSosConfirm(pending.medicineName), {
        parse_mode: "HTML",
      });

      // Broadcast to admin SOS channel/group
      await broadcastSosAlert(ctx, request, area);

      logger.info(
        `SOS created: "${pending.medicineName}" by user ${userId} in ${area || "unspecified area"}`
      );
    } catch (error) {
      logger.error(`SOS step error: ${error.message}`);
      pendingSos.delete(userId);
      await ctx.reply("⚠️ Failed to create SOS request. Please try again.");
    }

    return true;
  }

  return false;
};

/**
 * Broadcasts an SOS alert to the admin group/channel.
 */
const broadcastSosAlert = async (ctx, request, area) => {
  const sosChatId = process.env.SOS_ALERT_CHAT_ID;
  if (!sosChatId) return;

  try {
    const alertMessage =
      `🚨 <b>SOS MEDICINE REQUEST</b> 🚨\n\n` +
      `💊 Medicine: <b>${escapeHtml(request.medicineName)}</b>\n` +
      `📍 Area: ${escapeHtml(area || "Not specified")}\n` +
      `👤 User: @${escapeHtml(ctx.from.username || "anonymous")} (ID: ${ctx.from.id})\n` +
      `🕐 Time: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}\n\n` +
      `<i>If you can help, please contact the user directly or reply to this channel.</i>`;

    await ctx.api.sendMessage(sosChatId, alertMessage, {
      parse_mode: "HTML",
    });
  } catch (error) {
    logger.error(`SOS broadcast failed: ${error.message}`);
  }
};

/**
 * Check if a user is currently in an SOS flow.
 */
const isInSosFlow = (userId) => pendingSos.has(userId);

module.exports = { handleSos, handleSosStep, isInSosFlow };
