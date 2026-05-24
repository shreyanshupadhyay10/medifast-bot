const RISKY_TERMS = [
  "modafinil",
  "modalert",
  "antibiotic",
  "azithromycin",
  "amoxicillin",
  "clonazepam",
  "rivotril",
  "sleeping pill",
];

const DISCLAIMER = "This bot helps discover medicines and is not a replacement for a doctor.";

const assessSafety = ({ entities = {}, intent = {}, mentionedMember = null, query = "" }) => {
  const normalized = String(query || entities.normalizedText || "").toLowerCase();
  const notes = [];

  if (intent.needsFollowUp) {
    notes.push("I need one more detail before searching confidently.");
  }

  if (mentionedMember?.ageGroup === "child" || intent.ageGroup === "child") {
    notes.push("For children, confirm medicine and dose with a doctor or pharmacist.");
  }

  if (mentionedMember?.ageGroup === "senior" || intent.ageGroup === "senior") {
    notes.push("For seniors, check existing conditions and regular medicines before use.");
  }

  if (RISKY_TERMS.some((term) => normalized.includes(term))) {
    notes.push("This may involve prescription or higher-risk medicine. Do not self-medicate.");
  }

  notes.push(DISCLAIMER);

  return {
    shouldClarify: Boolean(intent.needsFollowUp),
    notes: [...new Set(notes)],
  };
};

const appendSafetyNotes = (message, safety) => {
  if (!safety?.notes?.length) return message;
  return `${message}\n\n${safety.notes.map((note) => `⚠️ <i>${note}</i>`).join("\n")}`;
};

module.exports = {
  DISCLAIMER,
  assessSafety,
  appendSafetyNotes,
};
