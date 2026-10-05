const mongoose = require("mongoose");

const mealPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    mealType: {
      type: String,
      required: true,
      enum: ["breakfast", "lunch", "dinner"],
      trim: true,
    },
    recipes: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Recipe" }],
      default: [],
    },
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      default: null,
    },
    // Kept as the slot-level default so plans saved before per-recipe
    // servings existed keep a sensible fallback value.
    servings: {
      type: Number,
      min: 1,
      max: 20,
      default: 1,
    },
    // Servings are tracked per recipe so two recipes can share the same meal
    // slot without overwriting each other's serving count.
    servingsByRecipe: {
      type: Map,
      of: Number,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

mealPlanSchema.index({ user: 1, date: 1, mealType: 1 });
mealPlanSchema.index({ user: 1, date: 1 });

const MealPlan = mongoose.model("MealPlan", mealPlanSchema);

module.exports = MealPlan;
