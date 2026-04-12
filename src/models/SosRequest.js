const mongoose = require("mongoose");

const sosRequestSchema = new mongoose.Schema(
  {
    medicineName: {
      type: String,
      required: true,
      trim: true,
    },
    requestedBy: {
      telegramId: { type: String, required: true },
      username: { type: String },
      firstName: { type: String },
    },
    area: {
      type: String,
      trim: true,
    },
    contact: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["open", "resolved", "closed"],
      default: "open",
    },
    resolvedBy: {
      pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "Pharmacy" },
      note: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SosRequest", sosRequestSchema);
