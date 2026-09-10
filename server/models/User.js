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