const mongoose = require("mongoose");

const factSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
    },
    entity: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.75,
    },
    source: {
      type: String,
      trim: true,
      default: "message",
    },
    embeddingId: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const recentMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "bot"],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const conversationMemorySchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    facts: [factSchema],
    conversationSummary: {
      type: String,
      trim: true,
      default: "",
      maxlength: 3000,
    },
    recentMessages: [recentMessageSchema],
    embeddingId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ConversationMemory", conversationMemorySchema);
