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
    phone: {
      type: String,
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
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
      },
    },
    city: {
      type: String,
      trim: true,
      default: "Jaipur",
      index: true,
    },
    inventory: [{ type: String, trim: true }],
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.75,
    },
    source: {
      type: String,
      trim: true,
      default: "manual",
    },
    sourceMetadata: {
      source: { type: String, trim: true },
      importedAt: Date,
      trustLevel: { type: String, trim: true },
      datasetVersion: { type: String, trim: true },
      osmType: { type: String, trim: true },
      osmId: { type: String, trim: true, index: true },
    },
    lastVerified: {
      type: Date,
      default: Date.now,
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
pharmacySchema.index({ location: "2dsphere" }, { sparse: true });

pharmacySchema.pre("save", function syncLocationFields(next) {
  if (!this.phone && this.contact?.phone) this.phone = this.contact.phone;
  if (!this.location?.coordinates?.length && this.geoLocation?.coordinates?.length) {
    this.location = {
      type: "Point",
      coordinates: this.geoLocation.coordinates,
    };
  }
  if (!this.geoLocation?.coordinates?.length && this.location?.coordinates?.length) {
    this.geoLocation = {
      type: "Point",
      coordinates: this.location.coordinates,
    };
  }
  next();
});

module.exports = mongoose.model("Pharmacy", pharmacySchema);
