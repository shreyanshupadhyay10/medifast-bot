const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    medicineName: {
      type: String,
      required: [true, "Medicine name is required"],
      trim: true,
      index: true,
    },
    // Normalized lowercase version for search indexing
    medicineNameLower: {
      type: String,
      index: true,
    },
    genericName: {
      type: String,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        "antibiotic",
        "painkiller",
        "antidiabetic",
        "cardiac",
        "dermatology",
        "gastro",
        "respiratory",
        "neurological",
        "vitamins",
        "rare",
        "other",
      ],
      default: "other",
    },
    pharmacy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pharmacy",
      required: true,
      index: true,
    },
    price: {
      type: Number,
      min: 0,
    },
    unit: {
      type: String,
      default: "strip", // strip, bottle, injection, etc.
    },
    inStock: {
      type: Boolean,
      default: true,
      index: true,
    },
    quantity: {
      type: Number,
      default: null, // null means "available but quantity unknown"
    },
    isRare: {
      // Triggers SOS alert when someone searches this
      type: Boolean,
      default: false,
    },
    requiresPrescription: {
      type: Boolean,
      default: false,
    },
    lastVerified: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to normalize medicine name for search
inventorySchema.pre("save", function (next) {
  this.medicineNameLower = this.medicineName.toLowerCase();
  next();
});

// Compound index: one medicine entry per pharmacy
inventorySchema.index({ medicineName: 1, pharmacy: 1 }, { unique: true });

// Text index for MongoDB native text search (backup to Fuse.js)
inventorySchema.index({
  medicineName: "text",
  genericName: "text",
  brand: "text",
});

module.exports = mongoose.model("Inventory", inventorySchema);
