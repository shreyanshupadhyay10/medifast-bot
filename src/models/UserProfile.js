const mongoose = require("mongoose");

const familyMemberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    relation: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 30,
    },
    ageGroup: {
      type: String,
      enum: ["child", "adult", "senior"],
      default: "adult",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 180,
    },
    guardianName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    guardianTelegramId: {
      type: String,
      trim: true,
    },
    notifyGuardian: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const userProfileSchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      trim: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    preferredLanguage: {
      type: String,
      enum: ["english", "hinglish", "hindi"],
      default: "hinglish",
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    locationPermissionAccepted: {
      type: Boolean,
      default: false,
    },
    homeLocation: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
      },
      label: {
        type: String,
        trim: true,
      },
      updatedAt: Date,
    },
    familyMembers: [familyMemberSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserProfile", userProfileSchema);
