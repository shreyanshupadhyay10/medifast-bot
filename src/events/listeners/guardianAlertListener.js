const logger = require("../../utils/logger");

const registerGuardianAlertListener = (eventBus, bot = null) => {
  eventBus.on("guardian.alert.requested", async ({ guardianTelegramId, message }) => {
    if (!guardianTelegramId || !message) return;
    try {
      if (bot?.api) {
        await bot.api.sendMessage(guardianTelegramId, message, { parse_mode: "HTML" });
      }
    } catch (error) {
      logger.error(`Guardian alert listener error: ${error.message}`);
    }
  });
};

module.exports = {
  registerGuardianAlertListener,
};
