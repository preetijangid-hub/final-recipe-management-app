const mongoose = require("mongoose");

const SPICE_LEVELS = ["Mild", "Medium", "Hot", "Very Hot"];
const SWEETNESS_LEVELS = ["Not Sweet", "Lightly Sweet", "Sweet", "Very Sweet"];
const CUISINES = [
  "Indian",
  "Italian",
  "Mexican",
  "Thai",
  "Chinese",
  "Japanese",
  "Korean",
  "French",
  "American",
  "Mediterranean",
];
const MEAL_CATEGORIES = [
  "Breakfast",
  "Brunch",
  "Lunch",
  "Dinner",
  "Dessert",
  "Snacks",
  "Mocktails",
  "Drinks",
];

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
    description: {
      // Optional short summary. Older recipes simply have none.
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    cookingTime: {
      // Total cooking time in minutes. Recipes created before this field
      // existed keep it unset so they are not treated as instant recipes.
      type: Number,
      min: 1,
      max: 600,
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
    mealCategory: {
      // Required for new recipes; existing recipes may not have one.
      type: String,
      required: function () {
        return this.isNew;
      },
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
recipeSchema.index({ mealCategory: 1 });
recipeSchema.index({ orderCount: -1 });
recipeSchema.index({ createdAt: -1 });

// Free-text index behind the search box. Only one text index is allowed per
// collection, so every searchable recipe field is listed here. Titles weigh
// the most because a title match is usually the one users mean.
recipeSchema.index(
  {
    title: "text",
    description: "text",
    ingredients: "text",
  },
  {
    name: "recipe_search_text",
    weights: {
      title: 5,
      ingredients: 3,
      description: 1,
    },
  }
);

// Supporting index for the maximum cooking time filter and its sorting.
recipeSchema.index({ cookingTime: 1 });

const Recipe = mongoose.model("Recipe", recipeSchema);

module.exports = Recipe;
module.exports.SPICE_LEVELS = SPICE_LEVELS;
module.exports.SWEETNESS_LEVELS = SWEETNESS_LEVELS;
module.exports.CUISINES = CUISINES;
module.exports.MEAL_CATEGORIES = MEAL_CATEGORIES;