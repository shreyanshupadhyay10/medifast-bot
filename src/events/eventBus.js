const EventEmitter = require("events");
const logger = require("../utils/logger");

class MediFastEventBus extends EventEmitter {
  emitSafe(eventName, payload = {}) {
    try {
      this.emit(eventName, payload);
    } catch (error) {
      logger.error(`Event listener failed for ${eventName}: ${error.message}`);
    }
  }
}

module.exports = new MediFastEventBus();
