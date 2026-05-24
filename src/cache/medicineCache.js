const DEFAULT_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

const now = () => Date.now();
const makeKey = (query, options = {}) =>
  JSON.stringify({
    query: String(query || "").toLowerCase().trim(),
    searchTerms: options.searchTerms || [],
    categories: options.categories || [],
  });

const get = (query, options = {}) => {
  const key = makeKey(query, options);
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

const set = (query, options = {}, value, ttlMs = DEFAULT_TTL_MS) => {
  cache.set(makeKey(query, options), {
    value,
    expiresAt: now() + ttlMs,
  });
  return value;
};

const clear = () => cache.clear();

module.exports = {
  clear,
  get,
  set,
};
