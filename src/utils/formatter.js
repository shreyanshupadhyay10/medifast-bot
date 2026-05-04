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

const MEDICAL_DISCLAIMER =
  "This bot helps discover medicines and is not a replacement for a doctor.";

const formatAvailabilityConfidence = (score) => {
  if (score <= 0.18) return "High";
  if (score <= 0.38) return "Good";
  return "Discovery";
};

const formatUseCase = (item, intent) => {
  if (intent?.label) return intent.label;
  const categoryMap = {
    painkiller: "pain relief / fever support",
    gastro: "stomach / acidity support",
    respiratory: "cold / cough / allergy support",
    vitamins: "vitamin support",
    antidiabetic: "diabetes care",
    cardiac: "heart health",
    dermatology: "skin care",
    neurological: "neurology",
    antibiotic: "infection care",
  };
  return categoryMap[item.category] || "medicine availability";
};

/**
 * Format a list of inventory search results into a Telegram HTML message.
 */
const formatSearchResults = (results, query, context = {}) => {
  const displayed = results.slice(0, MAX_RESULTS_PER_MESSAGE);
  const hasMore = results.length > MAX_RESULTS_PER_MESSAGE;
  const { intent, mentionedMember, repeatSearch } = context;

  let message = `🏥 <b>MediFast AI Results</b>\n`;
  message += `Query: <b>${escapeHtml(query)}</b>\n`;
  if (intent?.label) {
    message += `Understood as: <i>${escapeHtml(intent.label)}</i>`;
    if (intent.confidence) message += ` (${escapeHtml(intent.confidence)} confidence)`;
    message += `\n`;
  }
  if (mentionedMember) {
    message += `For: <b>${escapeHtml(mentionedMember.name)}</b> (${escapeHtml(mentionedMember.ageGroup)})\n`;
  }
  message += `Found <b>${results.length}</b> live match${results.length !== 1 ? "es" : ""}\n`;
  if (repeatSearch?.topMedicineName) {
    message += `\n🔁 Need to reorder previous medicine: <b>${escapeHtml(repeatSearch.topMedicineName)}</b>?\n`;
  }
  message += `\n`;

  displayed.forEach((item, index) => {
    const stockEmoji = item.inStock ? "✅" : "❌";
    const rareTag = item.isRare ? " 🔴 <b>[RARE]</b>" : "";
    const rxTag = item.requiresPrescription ? " 📋 <i>Rx required</i>" : "";

    message += `${index + 1}. ${stockEmoji} <b>${escapeHtml(item.medicineName)}</b>${rareTag}\n`;
    message += `   Use case: ${escapeHtml(formatUseCase(item, intent))}\n`;

    if (item.genericName) {
      message += `   Salt: <i>${escapeHtml(item.genericName)}</i>\n`;
    }

    if (item.brand) {
      message += `   Brand/alternative: ${escapeHtml(item.brand)}\n`;
    }

    message += `   💊 ${formatPrice(item.price, item.unit)}${rxTag}\n`;
    message += `   Confidence: ${formatAvailabilityConfidence(item.matchScore)}\n`;
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

  if (intent?.safetyNote) {
    message += `\n⚕️ <i>${escapeHtml(intent.safetyNote)}</i>\n`;
  }

  message += `\n💡 <i>Stock info may change. Call ahead to confirm.</i>\n`;
  message += `⚠️ <i>${MEDICAL_DISCLAIMER}</i>`;

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

const formatSearchFollowUp = (query) => {
  return (
    `🤔 <b>I need one more detail</b>\n\n` +
    `I could not confidently understand "${escapeHtml(query)}".\n` +
    `Try a medicine name like <code>Dolo 650</code>, or a symptom like <code>bukhar ki tablet</code>, <code>sar dard</code>, <code>gas acidity</code>.\n\n` +
    `<i>${MEDICAL_DISCLAIMER}</i>`
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
    `🏥 <b>MediFast AI</b>\n\n` +
    `Namaste ${escapeHtml(firstName || "there")}! 🙏\n\n` +
    `India-first medicine assistant for Telegram. Search in English, Hindi, or Hinglish and find pharmacy availability fast.\n\n` +
    `<b>How to use:</b>\n` +
    `• Type a medicine or symptom: <code>bukhar ki tablet</code>, <code>sar dard</code>, <code>gas acidity</code>\n` +
    `• /search <i>medicine name</i> — search directly\n` +
    `• /family — save family profiles\n` +
    `• /nearby — browse or share location\n` +
    `• /sos <i>medicine name</i> — raise an alert\n` +
    `• /help — all commands\n\n` +
    `<i>${MEDICAL_DISCLAIMER}</i>`
  );
};

/**
 * Format the /help message.
 */
const formatHelp = () => {
  return (
    `<b>📋 MediFast AI — Commands</b>\n\n` +
    `<b>🔍 Search</b>\n` +
    `/search &lt;name or symptom&gt; — Search medicines\n` +
    `<i>Or just type: bukhar ki tablet, sar dard, cough medicine</i>\n\n` +
    `<b>👨‍👩‍👧 Family</b>\n` +
    `/family — Family medicine dashboard\n` +
    `/addmember — Add a family member\n` +
    `/members — View saved members\n` +
    `/removeMember &lt;name&gt; — Remove a member\n\n` +
    `<b>🆘 SOS</b>\n` +
    `/sos &lt;name&gt; — Alert the network for a rare/unavailable medicine\n\n` +
    `<b>📍 Browse</b>\n` +
    `/nearby — Find pharmacies by area\n` +
    `/areas — List all covered areas\n\n` +
    `<b>ℹ️ Info</b>\n` +
    `/about — About this bot\n` +
    `/feedback — Send feedback\n\n` +
    `💡 <i>Tip: Try “mom fever medicine” or “reorder papa medicine”.</i>\n\n` +
    `⚠️ <i>${MEDICAL_DISCLAIMER}</i>`
  );
};

const formatFamilyMenu = (profile) => {
  return (
    `👨‍👩‍👧 <b>Family Medicine Hub</b>\n\n` +
    `Saved members: <b>${profile.familyMembers.length}</b>\n\n` +
    `Search naturally: <code>mom fever medicine</code>, <code>papa BP tablet</code>, or <code>reorder papa medicine</code>.`
  );
};

const formatAddMemberPrompt = () => {
  return (
    `➕ <b>Add Family Member</b>\n\n` +
    `Send details in this format:\n` +
    `<code>Name|relation|age group|notes</code>\n\n` +
    `Age group can be <b>child</b>, <b>adult</b>, or <b>senior</b>.\n\n` +
    `Example:\n<code>Papa|papa|senior|diabetes and BP</code>`
  );
};

const formatMembers = (profile) => {
  if (!profile.familyMembers.length) {
    return "👨‍👩‍👧 <b>No family members yet.</b>\n\nUse /addmember to save one.";
  }

  let message = `👨‍👩‍👧 <b>Your Family Members</b>\n\n`;
  profile.familyMembers.forEach((member, index) => {
    message += `${index + 1}. <b>${escapeHtml(member.name)}</b> — ${escapeHtml(member.relation)}\n`;
    message += `   Age group: ${escapeHtml(member.ageGroup)}\n`;
    if (member.notes) message += `   Notes: ${escapeHtml(member.notes)}\n`;
    message += `\n`;
  });
  message += `<i>Try: reorder papa medicine, mom fever medicine.</i>`;
  return message;
};

const formatReorderPrompt = (member, recent) => {
  if (!recent) {
    return (
      `🔁 <b>Reorder</b>\n\n` +
      `I found ${member ? escapeHtml(member.name) : "that family member"}, but there is no recent medicine history yet.\n` +
      `Try searching first, for example: <code>${member ? escapeHtml(member.relation) : "papa"} fever medicine</code>.`
    );
  }

  return (
    `🔁 <b>Reorder previous medicine?</b>\n\n` +
    `For: <b>${escapeHtml(member.name)}</b>\n` +
    `Previous medicine: <b>${escapeHtml(recent.topMedicineName)}</b>\n` +
    `Last searched: ${new Date(recent.createdAt).toLocaleDateString("en-IN")}\n\n` +
    `Type <code>${escapeHtml(recent.topMedicineName)}</code> to check live availability again.`
  );
};

module.exports = {
  formatSearchResults,
  formatNotFound,
  formatSosConfirm,
  formatWelcome,
  formatHelp,
  formatSearchFollowUp,
  formatFamilyMenu,
  formatAddMemberPrompt,
  formatMembers,
  formatReorderPrompt,
  escapeHtml,
};
