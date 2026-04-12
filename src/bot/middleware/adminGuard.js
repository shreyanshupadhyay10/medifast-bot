const logger = require("../../utils/logger");

const isAdmin = (ctx, next) => {
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const userId = String(ctx.from?.id);

  if (!adminIds.includes(userId)) {
    logger.warn(`Unauthorized admin access attempt by user: ${userId}`);
    return ctx.reply("⛔ You are not authorized to use this command.");
  }

  return next();
};

module.exports = { isAdmin };
