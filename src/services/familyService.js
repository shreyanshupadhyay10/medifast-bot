const UserProfile = require("../models/UserProfile");
const { normalizeQuery } = require("./intentEngine");

const RELATION_ALIASES = {
  papa: ["papa", "father", "dad", "pitaji"],
  mummy: ["mummy", "mom", "mother", "maa", "mumma"],
  child: ["child", "kid", "baby", "bachcha", "bacha", "baccha", "beta", "beti"],
  spouse: ["wife", "husband", "spouse"],
  grandparent: ["dada", "dadi", "nana", "nani", "grandfather", "grandmother"],
};

const getOrCreateProfile = async (from) => {
  const telegramId = String(from.id);
  return UserProfile.findOneAndUpdate(
    { telegramId },
    {
      $set: {
        username: from.username || undefined,
        firstName: from.first_name || undefined,
      },
      $setOnInsert: {
        telegramId,
        preferredLanguage: "hinglish",
      },
    },
    { upsert: true, new: true }
  );
};

const setLanguage = async (from, preferredLanguage) => {
  const profile = await getOrCreateProfile(from);
  profile.preferredLanguage = preferredLanguage;
  profile.onboardingCompleted = true;
  await profile.save();
  return profile;
};

const addFamilyMember = async (from, member) => {
  const profile = await getOrCreateProfile(from);
  profile.familyMembers.push(member);
  profile.onboardingCompleted = true;
  await profile.save();
  return profile;
};

const removeFamilyMember = async (from, nameOrRelation) => {
  const profile = await getOrCreateProfile(from);
  const target = normalizeQuery(nameOrRelation);
  const before = profile.familyMembers.length;
  profile.familyMembers = profile.familyMembers.filter((member) => {
    const name = normalizeQuery(member.name);
    const relation = normalizeQuery(member.relation);
    return name !== target && relation !== target;
  });
  await profile.save();
  return { profile, removed: before - profile.familyMembers.length };
};

const findMentionedFamilyMember = (profile, rawQuery) => {
  if (!profile || !rawQuery) return null;
  const query = normalizeQuery(rawQuery);

  return profile.familyMembers.find((member) => {
    const name = normalizeQuery(member.name);
    const relation = normalizeQuery(member.relation);
    const aliases = RELATION_ALIASES[relation] || [];
    return query.includes(name) || query.includes(relation) || aliases.some((alias) => query.includes(alias));
  });
};

const parseFamilyMemberInput = (input) => {
  const parts = String(input || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 3) return null;

  const [name, relation, ageGroup, notes] = parts;
  const normalizedAge = normalizeQuery(ageGroup);
  const safeAgeGroup = ["child", "adult", "senior"].includes(normalizedAge)
    ? normalizedAge
    : "adult";

  return {
    name,
    relation,
    ageGroup: safeAgeGroup,
    notes: notes || undefined,
  };
};

module.exports = {
  getOrCreateProfile,
  setLanguage,
  addFamilyMember,
  removeFamilyMember,
  findMentionedFamilyMember,
  parseFamilyMemberInput,
};
