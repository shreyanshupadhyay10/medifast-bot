const Fuse = require("fuse.js");

const normalize = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const INTENTS = [
  {
    key: "headache",
    label: "headache / pain relief",
    searchTerms: ["Paracetamol", "Dolo", "Ibuprofen"],
    categories: ["painkiller"],
    signals: [
      "sar dard",
      "sirdard",
      "sir dard",
      "headache",
      "head ache",
      "migraine",
      "pain relief",
      "dard ki dawa",
    ],
    safetyNote: "For severe, repeated, or injury-related headache, speak to a doctor.",
  },
  {
    key: "fever",
    label: "fever",
    searchTerms: ["Paracetamol", "Dolo 650mg", "Calpol"],
    categories: ["painkiller"],
    signals: ["bukhar", "bhukhar", "fever", "temperature", "viral fever", "jwar"],
    safetyNote: "For children, high fever, pregnancy, or fever lasting more than 2 days, consult a doctor.",
  },
  {
    key: "cough",
    label: "cough",
    searchTerms: ["cough", "Cetirizine", "Salbutamol"],
    categories: ["respiratory"],
    signals: ["khansi", "khaansi", "cough", "dry cough", "wet cough", "balgam"],
    safetyNote: "Cough with breathing trouble, chest pain, or blood needs urgent medical advice.",
  },
  {
    key: "cold",
    label: "cold / allergy",
    searchTerms: ["Cetirizine", "cold", "allergy"],
    categories: ["respiratory"],
    signals: ["zukham", "zukaam", "jukham", "cold", "sardi", "naak behna", "running nose", "allergy"],
    safetyNote: "Avoid sedating medicines before driving unless a doctor or pharmacist confirms suitability.",
  },
  {
    key: "stomach_pain",
    label: "stomach pain",
    searchTerms: ["stomach pain", "gastro", "Omeprazole", "Pantoprazole"],
    categories: ["gastro"],
    signals: ["pet dard", "pait dard", "stomach pain", "abdominal pain", "tummy pain", "gastric pain"],
    safetyNote: "Severe stomach pain, vomiting blood, or pain with fever should be checked urgently.",
  },
  {
    key: "acidity",
    label: "gas / acidity",
    searchTerms: ["Pantoprazole", "Omeprazole", "acidity", "gas"],
    categories: ["gastro"],
    signals: ["gas", "acidity", "aciditi", "heartburn", "jalna", "pet me gas", "indigestion"],
    safetyNote: "Frequent acidity can need medical review, especially with chest pain or weight loss.",
  },
  {
    key: "nausea",
    label: "nausea / vomiting",
    searchTerms: ["Ondansetron", "nausea", "vomiting"],
    categories: ["gastro"],
    signals: ["ulti", "vomit", "vomiting", "nausea", "jee machalna", "chakkar"],
    safetyNote: "Repeated vomiting, dehydration, pregnancy, or child vomiting needs professional advice.",
  },
];

const fuse = new Fuse(
  INTENTS.flatMap((intent) =>
    intent.signals.map((signal) => ({
      ...intent,
      signal,
    }))
  ),
  {
    keys: ["signal"],
    threshold: 0.32,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 3,
  }
);

const detectAgeGroup = (query) => {
  if (/\b(child|kid|baby|infant|bachcha|bacha|baccha|beta|beti)\b/.test(query)) {
    return "child";
  }
  if (/\b(senior|elder|old|papa|father|mummy|mom|mother|dada|dadi|nana|nani)\b/.test(query)) {
    return "senior";
  }
  return null;
};

const detectIntent = (rawQuery) => {
  const query = normalize(rawQuery);
  if (!query) {
    return {
      originalQuery: rawQuery,
      normalizedQuery: rawQuery,
      confidence: "low",
      needsFollowUp: true,
    };
  }

  const direct = INTENTS.find((intent) =>
    intent.signals.some((signal) => query.includes(signal))
  );

  if (direct) {
    return {
      ...direct,
      originalQuery: rawQuery,
      normalizedQuery: direct.searchTerms[0],
      confidence: "high",
      ageGroup: detectAgeGroup(query),
      needsFollowUp: false,
    };
  }

  const [best] = fuse.search(query);
  if (best && best.score <= 0.24) {
    return {
      ...best.item,
      originalQuery: rawQuery,
      normalizedQuery: best.item.searchTerms[0],
      confidence: "medium",
      ageGroup: detectAgeGroup(query),
      needsFollowUp: false,
    };
  }

  const medicineLike = query.length >= 3 && /\p{L}/u.test(query);
  return {
    originalQuery: rawQuery,
    normalizedQuery: rawQuery.trim(),
    confidence: medicineLike ? "medicine" : "low",
    needsFollowUp: !medicineLike,
  };
};

module.exports = {
  INTENTS,
  detectIntent,
  normalizeQuery: normalize,
};
