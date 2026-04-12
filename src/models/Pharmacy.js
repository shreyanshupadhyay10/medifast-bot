const mongoose = require("mongoose");

const pharmacySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Pharmacy name is required"],
      trim: true,
      index: true,
    },
    area: {
      type: String,
      required: [true, "Area/locality is required"],
      trim: true,
    },
    address: {
      type: String,
      required: [true, "Full address is required"],
      trim: true,
    },
    contact: {
      phone: { type: String, trim: true },
      whatsapp: { type: String, trim: true },
    },
    // GeoJSON — optional, only set when lat/lng is known
    geoLocation: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
      },
    },
    openingHours: {
      type: String,
      default: "9:00 AM – 10:00 PM",
    },
    is24x7: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Sparse index — skips docs where geoLocation is not set
pharmacySchema.index({ geoLocation: "2dsphere" }, { sparse: true });

module.exports = mongoose.model("Pharmacy", pharmacySchema);