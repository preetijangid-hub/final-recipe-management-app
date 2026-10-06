const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    // Creator profile fields. The photo is a URL string only, matching how
    // recipe images and collection covers are stored. Real upload UI comes
    // in a later phase.
    profilePhoto: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    profession: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    preferences: {
      allergies: {
        type: [String],
        default: [],
      },
      avoidIngredients: {
        type: [String],
        default: [],
      },
      preferredIngredients: {
        type: [String],
        default: [],
      },
      dietaryPreferences: {
        type: [String],
        default: [],
      },
      spiceLevel: {
        type: String,
        trim: true,
        default: "",
      },
      sweetnessLevel: {
        type: String,
        trim: true,
        default: "",
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);