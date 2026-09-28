const mongoose = require("mongoose");

const SENTIMENTS = ["Positive", "Neutral", "Negative", "Unknown"];

const reviewSchema = new mongoose.Schema(
  {
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 1000,
    },
    sentiment: {
      type: String,
      enum: SENTIMENTS,
      default: "Unknown",
    },
  },
  {
    timestamps: true,
  }
);

// One review per user per recipe, enforced at the database level.
reviewSchema.index({ user: 1, recipe: 1 }, { unique: true });
reviewSchema.index({ recipe: 1, createdAt: -1 });

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review;
module.exports.SENTIMENTS = SENTIMENTS;