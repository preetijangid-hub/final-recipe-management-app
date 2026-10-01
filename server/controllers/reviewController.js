const Recipe = require("../models/Recipe");
const Review = require("../models/Review");
const { toObjectId } = require("../utils/recipeHelpers");
const { notifyRecipeOwner } = require("../utils/notificationService");

// Aggregated rating summary for one recipe, computed on the Review
// collection with an aggregation pipeline instead of on the frontend.
const aggregateRatingSummary = async (recipeId) => {
  const recipeObjectId = toObjectId(recipeId);

  const [result] = await Review.aggregate([
    {
      $match: { recipe: recipeObjectId },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  return {
    average: result
      ? Math.round(result.averageRating * 10) / 10
      : 0,
    count: result ? result.reviewCount : 0,
  };
};

// Keep the recipe's embedded ratings in sync so the existing recipe
// list/detail aggregation continues to show the correct averages.
const syncRecipeRating = async (recipe, userId, rating) => {
  const existingRating = recipe.ratings.find(
    (entry) => String(entry.user) === String(userId)
  );

  if (existingRating) {
    existingRating.value = rating;
  } else {
    recipe.ratings.push({
      user: userId,
      value: rating,
    });
  }

  await recipe.save();
};

const removeRecipeRating = async (recipe, userId) => {
  recipe.ratings = recipe.ratings.filter(
    (entry) => String(entry.user) !== String(userId)
  );

  await recipe.save();
};

// POST /api/recipes/:id/reviews
const createReview = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: "You need to sign in to review recipes.",
      });
    }

    const rating = Number(req.body.rating);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        message: "Rating must be a whole number between 1 and 5.",
      });
    }

    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    const existingReview = await Review.findOne({
      user: user._id,
      recipe: recipe._id,
    });

    if (existingReview) {
      return res.status(409).json({
        message: "You have already reviewed this recipe.",
      });
    }

    const review = await Review.create({
      recipe: recipe._id,
      user: user._id,
      rating,
      comment: req.body.comment,
      sentiment: req.body.sentiment,
    });

    await syncRecipeRating(recipe, user._id, rating);

    await review.populate("user", "name role");

    // Let the recipe owner know, without interrupting the review if the
    // notification could not be created.
    try {
      await notifyRecipeOwner({
        recipient: recipe.user,
        actor: user._id,
        recipe: recipe._id,
        type: "review",
      });
    } catch (notificationError) {
      console.error(
        "Review notification error:",
        notificationError.message
      );
    }

    return res.status(201).json({
      message: "Review created successfully",
      review,
      summary: await aggregateRatingSummary(recipe._id),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "You have already reviewed this recipe.",
      });
    }

    next(error);
  }
};

// GET /api/recipes/:id/reviews
const getRecipeReviews = async (req, res, next) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    const reviews = await Review.find({
      recipe: recipe._id,
    })
      .populate("user", "name role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      reviews,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/recipes/:id/reviews/summary
const getReviewSummary = async (req, res, next) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    return res.status(200).json({
      summary: await aggregateRatingSummary(recipe._id),
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/recipes/:id/reviews/:reviewId
const deleteReview = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: "You need to sign in to delete reviews.",
      });
    }

    const review = await Review.findOne({
      _id: req.params.reviewId,
      recipe: req.params.id,
    });

    if (!review) {
      return res.status(404).json({
        message: "Review not found",
      });
    }

    const recipe = await Recipe.findById(req.params.id);

    const isAuthor = String(review.user) === String(user._id);

    const isRecipeOwner =
      recipe && String(recipe.user) === String(user._id);

    const isAdmin = user.role === "admin";

    if (!isAuthor && !isRecipeOwner && !isAdmin) {
      return res.status(403).json({
        message: "You are not allowed to delete this review.",
      });
    }

    await Review.findByIdAndDelete(review._id);

    if (recipe) {
      await removeRecipeRating(recipe, review.user);
    }

    return res.status(200).json({
      message: "Review deleted successfully",
      summary: await aggregateRatingSummary(req.params.id),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  getRecipeReviews,
  getReviewSummary,
  deleteReview,
};