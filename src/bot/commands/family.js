const {
  addFamilyMember,
  getOrCreateProfile,
  parseFamilyMemberInput,
  removeFamilyMember,
} = require("../../services/familyService");
const {
  formatAddMemberPrompt,
  formatFamilyMenu,
  formatMembers,
} = require("../../utils/formatter");
const logger = require("../../utils/logger");

const pendingFamilyAdds = new Map();

const handleFamily = async (ctx) => {
  const profile = await getOrCreateProfile(ctx.from);
  await ctx.reply(formatFamilyMenu(profile), {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "➕ Add Family Member", callback_data: "family:add" },
          { text: "👨‍👩‍👧 View Members", callback_data: "family:members" },
        ],
        [{ text: "📍 Nearby Pharmacy", callback_data: "nearby:open" }],
      ],
    },
  });
};

const handleAddMember = async (ctx, args) => {
  if (!args) {
    pendingFamilyAdds.set(ctx.from.id, true);
    return ctx.reply(formatAddMemberPrompt(), { parse_mode: "HTML" });
  }

  const member = parseFamilyMemberInput(args);
  if (!member) {
    return ctx.reply(formatAddMemberPrompt(), { parse_mode: "HTML" });
  }

  const profile = await addFamilyMember(ctx.from, member);
  await ctx.reply(formatMembers(profile), { parse_mode: "HTML" });
};

const handleMembers = async (ctx) => {
  const profile = await getOrCreateProfile(ctx.from);
  await ctx.reply(formatMembers(profile), {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "➕ Add Member", callback_data: "family:add" }]],
    },
  });
};

const handleRemoveMember = async (ctx, args) => {
  if (!args) {
    return ctx.reply(
      "Send /removeMember followed by the member name or relation.\nExample: /removeMember papa"
    );
  }

  const { profile, removed } = await removeFamilyMember(ctx.from, args);
  await ctx.reply(
    removed > 0 ? formatMembers(profile) : "I could not find that family member yet. Use /members to check saved names.",
    { parse_mode: "HTML" }
  );
};

const handlePendingFamilyText = async (ctx) => {
  if (!pendingFamilyAdds.has(ctx.from.id)) return false;
  pendingFamilyAdds.delete(ctx.from.id);

  const member = parseFamilyMemberInput(ctx.message.text);
  if (!member) {
    await ctx.reply(formatAddMemberPrompt(), { parse_mode: "HTML" });
    return true;
  }

  try {
    const profile = await addFamilyMember(ctx.from, member);
    await ctx.reply(formatMembers(profile), { parse_mode: "HTML" });
  } catch (error) {
    logger.error(`Family add error: ${error.message}`);
    await ctx.reply("Could not save the family member. Please try again.");
  }

  return true;
};

module.exports = {
  handleFamily,
  handleAddMember,
  handleMembers,
  handleRemoveMember,
  handlePendingFamilyText,
};
