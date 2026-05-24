const { recordSearch } = require("../../services/historyService");
const logger = require("../../utils/logger");

const registerSearchHistoryListener = (eventBus) => {
  eventBus.on("search.completed", async (payload) => {
    try {
      await recordSearch(payload);
    } catch (error) {
      logger.error(`Search history listener error: ${error.message}`);
    }
  });
};

module.exports = {
  registerSearchHistoryListener,
};
