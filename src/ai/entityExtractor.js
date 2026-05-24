const { detectIntent, normalizeQuery } = require("../services/intentEngine");

const RELATION_TERMS = [
  "papa",
  "father",
  "dad",
  "mummy",
  "mom",
  "mother",
  "maa",
  "child",
  "kid",
  "baby",
  "beta",
  "beti",
  "dada",
  "dadi",
  "nana",
  "nani",
  "self",
  "me",
];

const REORDER_TERMS = ["reorder", "repeat", "refill", "dobara", "phir se"];
const NEARBY_TERMS = ["nearby", "near me", "5km", "10km", "pharmacy", "medical store", "location"];
const DURATION_PATTERNS = [
  /\b(\d+\s*(day|days|din|hour|hours|ghante|week|weeks))\b/i,
  /\b(kal se|aaj se|subah se|raat se|since yesterday|from today)\b/i,
];

const extractFirstMatch = (query, values) => values.find((value) => query.includes(value)) || null;

const extractDuration = (rawText) => {
  for (const pattern of DURATION_PATTERNS) {
    const match = rawText.match(pattern);
    if (match) return match[1] || match[0];
  }
  return null;
};

const extractEntities = (rawText = "", profile = null) => {
  const normalized = normalizeQuery(rawText);
  const intent = detectIntent(rawText);
  const profileMember = profile?.familyMembers?.find((member) => {
    const name = normalizeQuery(member.name);
    const relation = normalizeQuery(member.relation);
    return normalized.includes(name) || normalized.includes(relation);
  });

  const person = profileMember?.relation || extractFirstMatch(normalized, RELATION_TERMS);
  const reorderIntent = REORDER_TERMS.some((term) => normalized.includes(term));
  const nearbyIntent = NEARBY_TERMS.some((term) => normalized.includes(term));

  return {
    rawText,
    normalizedText: normalized,
    person,
    familyMemberName: profileMember?.name || null,
    symptom: intent.key && intent.confidence !== "medicine" ? intent.key : null,
    symptomLabel: intent.label || null,
    duration: extractDuration(rawText),
    medicine: intent.confidence === "medicine" ? intent.normalizedQuery : null,
    normalizedMedicineQuery: intent.normalizedQuery,
    reorderIntent,
    nearbyIntent,
    intent,
  };
};

module.exports = {
  extractEntities,
};
