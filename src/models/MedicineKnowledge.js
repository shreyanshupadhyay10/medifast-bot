const mongoose = require("mongoose");

const sourceMetadataSchema = new mongoose.Schema(
  {
    trustLevel: {
      type: String,
      enum: ["low", "medium", "high", "curated", "unknown"],
      default: "unknown",
    },
    importedAt: {
      type: Date,
      default: Date.now,
    },
    datasetVersion: {
      type: String,
      trim: true,
      default: "unknown",
    },
  },
  { _id: false }
);

const sideEffectSchema = new mongoose.Schema(
  {
    effect: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      trim: true,
      default: null,
    },
    frequency: {
      type: String,
      trim: true,
      default: null,
    },
    source: {
      type: String,
      trim: true,
      default: null,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.75,
    },
  },
  { _id: false }
);

const medicineKnowledgeSchema = new mongoose.Schema(
  {
    medicineName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    medicineNameLower: {
      type: String,
      index: true,
    },
    knowledgeKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    genericName: {
      type: String,
      trim: true,
      index: true,
    },
    salts: [{ type: String, trim: true }],
    brands: [{ type: String, trim: true }],
    aliases: [{ type: String, trim: true }],
    alternatives: [{ type: String, trim: true }],
    company: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: "other",
      index: true,
    },
    symptoms: [{ type: String, trim: true }],
    sideEffects: [sideEffectSchema],
    precautions: [{ type: String, trim: true }],
    prescriptionRequired: {
      type: Boolean,
      default: false,
      index: true,
    },
    commonSpellings: [{ type: String, trim: true }],
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.75,
    },
    source: {
      type: String,
      trim: true,
      default: "unknown",
      index: true,
    },
    sourceMetadata: {
      type: sourceMetadataSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

medicineKnowledgeSchema.pre("save", function setLowercase(next) {
  this.medicineNameLower = this.medicineName.toLowerCase();
  this.knowledgeKey = this.knowledgeKey || this.medicineNameLower;
  next();
});

medicineKnowledgeSchema.index({
  medicineName: "text",
  genericName: "text",
  salts: "text",
  brands: "text",
  aliases: "text",
  alternatives: "text",
  "sideEffects.effect": "text",
  commonSpellings: "text",
  symptoms: "text",
  category: "text",
});

module.exports = mongoose.model("MedicineKnowledge", medicineKnowledgeSchema);
