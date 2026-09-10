const mongoose = require("mongoose");

const SPICE_LEVELS = ["Mild", "Medium", "Hot", "Very Hot"];
const SWEETNESS_LEVELS = ["Not Sweet", "Lightly Sweet", "Sweet", "Very Sweet"];

const ratingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    value: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
  },
  { _id: false }
);

const recipeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    ingredients: {
      type: [String],
      required: true,
    },
    steps: {
      type: [String],
      required: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
      default: "",
    },
    spiceLevel: {
      type: String,
      enum: SPICE_LEVELS,
      default: "Mild",
    },
    sweetnessLevel: {
      type: String,
      enum: SWEETNESS_LEVELS,
      default: "Not Sweet",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ratings: {
      type: [ratingSchema],
      default: [],
    },
    orderCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastOrderedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

recipeSchema.index({ category: 1 });
recipeSchema.index({ orderCount: -1 });
recipeSchema.index({ createdAt: -1 });

const Recipe = mongoose.model("Recipe", recipeSchema);

module.exports = Recipe;
module.exports.SPICE_LEVELS = SPICE_LEVELS;
module.exports.SWEETNESS_LEVELS = SWEETNESS_LEVELS;