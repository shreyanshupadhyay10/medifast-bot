// Simple in-memory rate limiter for bot commands
// Prevents spam. For production, use Redis.

const userRequestMap = new Map();

const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 15,      // max 15 requests per minute per user
};

const rateLimiter = async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return next();

  const now = Date.now();
  const userData = userRequestMap.get(userId) || { count: 0, windowStart: now };

  // Reset window if expired
  if (now - userData.windowStart > RATE_LIMIT.windowMs) {
    userData.count = 0;
    userData.windowStart = now;
  }

  userData.count += 1;
  userRequestMap.set(userId, userData);

  if (userData.count > RATE_LIMIT.maxRequests) {
    const waitSeconds = Math.ceil(
      (RATE_LIMIT.windowMs - (now - userData.windowStart)) / 1000
    );
    return ctx.reply(
      `⏳ Slow down! You're sending too many requests. Please wait ${waitSeconds}s.`
    );
  }

  return next();
};

// Clean up old entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of userRequestMap.entries()) {
    if (now - data.windowStart > RATE_LIMIT.windowMs * 2) {
      userRequestMap.delete(userId);
    }
  }
}, 5 * 60 * 1000);

module.exports = { rateLimiter };
