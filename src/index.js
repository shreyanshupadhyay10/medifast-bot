require("dotenv").config();
const connectDB = require("../config/database");
const { createBot } = require("./bot");
const { createServer } = require("./server");
const logger = require("./utils/logger");

const PORT = parseInt(process.env.PORT || "3001", 10);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN;

const start = async () => {
  // 1. Connect to MongoDB
  await connectDB();

  // 2. Create the Telegram bot
  const bot = createBot();

  // 3. Create the Express server
  const app = createServer(bot);

  // 4. Start the server
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });

  // 5. Start the bot in the right mode
  if (IS_PRODUCTION && WEBHOOK_DOMAIN) {
    // Webhook mode — Telegram pushes updates to our server
    const webhookUrl = `${WEBHOOK_DOMAIN}/webhook`;
    await bot.api.setWebhook(webhookUrl);
    logger.info(`Webhook set to: ${webhookUrl}`);
  } else {
    // Long-polling mode — bot pulls updates (great for local dev)
    bot.start({
      onStart: (botInfo) => {
        logger.info(`Bot @${botInfo.username} is running in POLLING mode`);
      },
    });
  }

  // 6. Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    await bot.stop();
    process.exit(0);
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
};

start().catch((error) => {
  logger.error(`Failed to start application: ${error.message}`);
  process.exit(1);
});
