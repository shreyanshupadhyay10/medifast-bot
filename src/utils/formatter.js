/**
 * Formats search results into a readable Telegram message (HTML parse mode).
 */

const MAX_RESULTS_PER_MESSAGE = 5;

const escapeHtml = (text) => {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

const formatPrice = (price, unit) => {
  if (!price) return "Price N/A";
  return `₹${price}/${unit || "strip"}`;
};

const formatVerifiedTime = (date) => {
  if (!date) return "Unknown";
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

/**
 * Format a list of inventory search results into a Telegram HTML message.
 */
const formatSearchResults = (results, query) => {
  const displayed = results.slice(0, MAX_RESULTS_PER_MESSAGE);
  const hasMore = results.length > MAX_RESULTS_PER_MESSAGE;

  let message = `🔍 <b>Results for: "${escapeHtml(query)}"</b>\n`;
  message += `Found <b>${results.length}</b> match${results.length !== 1 ? "es" : ""}\n\n`;

  displayed.forEach((item, index) => {
    const stockEmoji = item.inStock ? "✅" : "❌";
    const rareTag = item.isRare ? " 🔴 <b>[RARE]</b>" : "";
    const rxTag = item.requiresPrescription ? " 📋 <i>Rx required</i>" : "";

    message += `${index + 1}. ${stockEmoji} <b>${escapeHtml(item.medicineName)}</b>${rareTag}\n`;

    if (item.genericName) {
      message += `   Generic: <i>${escapeHtml(item.genericName)}</i>\n`;
    }

    message += `   💊 ${formatPrice(item.price, item.unit)}${rxTag}\n`;
    message += `   🏪 <b>${escapeHtml(item.pharmacy.name)}</b> — ${escapeHtml(item.pharmacy.area)}\n`;
    message += `   📍 ${escapeHtml(item.pharmacy.address)}\n`;

    if (item.pharmacy.phone) {
      message += `   📞 ${escapeHtml(item.pharmacy.phone)}\n`;
    }
    if (item.pharmacy.whatsapp) {
      message += `   💬 WhatsApp: ${escapeHtml(item.pharmacy.whatsapp)}\n`;
    }

    message += `   🕐 ${escapeHtml(item.pharmacy.hours)}\n`;
    message += `   🔄 Verified: ${formatVerifiedTime(item.lastVerified)}\n`;
    message += `\n`;
  });

  if (hasMore) {
    message += `<i>... and ${results.length - MAX_RESULTS_PER_MESSAGE} more result(s). Refine your search for better results.</i>\n`;
  }

  message += `\n💡 <i>Stock info may change. Call ahead to confirm!</i>`;

  return message;
};

/**
 * Format a "not found" message with SOS prompt.
 */
const formatNotFound = (query) => {
  return (
    `😔 <b>No results for "${escapeHtml(query)}"</b>\n\n` +
    `This medicine wasn't found in our database.\n\n` +
    `You can:\n` +
    `• Try a different spelling or generic name\n` +
    `• Use /sos to raise an alert — our network will help locate it!\n` +
    `• Use /help to see all commands`
  );
};

/**
 * Format the SOS confirmation message.
 */
const formatSosConfirm = (medicineName) => {
  return (
    `🆘 <b>SOS Alert Raised!</b>\n\n` +
    `Medicine: <b>${escapeHtml(medicineName)}</b>\n\n` +
    `Your request has been broadcast to our pharmacy network in Jaipur.\n` +
    `You'll be notified if someone locates this medicine.\n\n` +
    `<i>This typically gets a response within 1–2 hours during business hours.</i>`
  );
};

/**
 * Format the /start welcome message.
 */
const formatWelcome = (firstName) => {
  return (
    `🏥 <b>Jaipur Pharmacy Bot</b>\n\n` +
    `Namaste ${escapeHtml(firstName || "there")}! 🙏\n\n` +
    `Find medicines at pharmacies near you in Jaipur — instantly.\n\n` +
    `<b>How to use:</b>\n` +
    `• Just type any medicine name to search\n` +
    `• /search <i>medicine name</i> — search directly\n` +
    `• /sos <i>medicine name</i> — can't find it? raise an alert!\n` +
    `• /nearby — browse by area\n` +
    `• /help — all commands\n\n` +
    `<b>Example:</b> Type <code>Paracetamol</code> or <code>Metformin 500mg</code>`
  );
};

/**
 * Format the /help message.
 */
const formatHelp = () => {
  return (
    `<b>📋 Jaipur Pharmacy Bot — Commands</b>\n\n` +
    `<b>🔍 Search</b>\n` +
    `/search &lt;name&gt; — Search for a medicine\n` +
    `<i>Or just type the medicine name directly!</i>\n\n` +
    `<b>🆘 SOS</b>\n` +
    `/sos &lt;name&gt; — Alert the network for a rare/unavailable medicine\n\n` +
    `<b>📍 Browse</b>\n` +
    `/nearby — Find pharmacies by area\n` +
    `/areas — List all covered areas\n\n` +
    `<b>ℹ️ Info</b>\n` +
    `/about — About this bot\n` +
    `/feedback — Send feedback\n\n` +
    `💡 <i>Tip: Fuzzy search works! "paracetamol", "paracitamol", "PCM" all work.</i>`
  );
};

module.exports = {
  formatSearchResults,
  formatNotFound,
  formatSosConfirm,
  formatWelcome,
  formatHelp,
  escapeHtml,
};
