const Favourite = require("../models/Favourite");
const Recipe = require("../models/Recipe");
const {
  mapRecipe,
  summarizeRating,
} = require("../utils/recipeHelpers");

// GET /api/favourites
// Returns only the signed-in user's favourites, newest first.
const getMyFavourites = async (req, res, next) => {
  try {
    const favourites = await Favourite.find({
      user: req.user._id,
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "recipe",
        populate: {
          path: "user",
          select: "name email role",
        },
      })
      .lean();

    // A recipe deleted after being favourited leaves an empty reference
    // behind, so those entries are skipped.
    const recipes = favourites
      .filter((favourite) => favourite.recipe)
      .map((favourite) => {
        const rating = summarizeRating(
          favourite.recipe,
          req.user._id
        );

        return mapRecipe({
          ...favourite.recipe,
          averageRating: rating.average,
          ratingCount: rating.count,
          myRating: rating.mine,
        });
      });

    return res.status(200).json({
      favourites: recipes,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/favourites/:recipeId
const addFavourite = async (req, res, next) => {
  try {
    const recipe = await Recipe.findById(
      req.params.recipeId
    );

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    const existingFavourite = await Favourite.findOne({
      user: req.user._id,
      recipe: recipe._id,
    });

    if (existingFavourite) {
      return res.status(409).json({
        message: "This recipe is already in your favourites.",
      });
    }

    await Favourite.create({
      user: req.user._id,
      recipe: recipe._id,
    });

    return res.status(201).json({
      message: "Recipe added to favourites.",
    });
  } catch (error) {
    // The unique index can reject a duplicate created by a
    // concurrent request.
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This recipe is already in your favourites.",
      });
    }

    next(error);
  }
};

// DELETE /api/favourites/:recipeId
const removeFavourite = async (req, res, next) => {
  try {
    const favourite = await Favourite.findOneAndDelete({
      user: req.user._id,
      recipe: req.params.recipeId,
    });

    if (!favourite) {
      return res.status(404).json({
        message: "This recipe is not in your favourites.",
      });
    }

    return res.status(200).json({
      message: "Recipe removed from favourites.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyFavourites,
  addFavourite,
  removeFavourite,
};
