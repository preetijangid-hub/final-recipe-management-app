const Recipe = require("../models/Recipe");

const {
  mapRecipe,
  summarizeRating,
} = require("../utils/recipeHelpers");

const TRENDING_WINDOW_DAYS = 14;

const getRecipeStats = async (req, res, next) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        message: "You need to sign in to view recipe statistics.",
      });
    }

    const trendingCutoff = new Date(
      Date.now() -
        TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );

    const recipes = await Recipe.find({})
      .populate("user", "name email role")
      .lean();

    const enrichedRecipes = recipes.map((recipe) => {
      const rating = summarizeRating(recipe, userId);

      return {
        ...recipe,
        averageRating: rating.average,
        ratingCount: rating.count,
        myRating: rating.mine,
      };
    });

    const totalRecipes = enrichedRecipes.length;

    const totalOrders = enrichedRecipes.reduce(
      (sum, recipe) => sum + Number(recipe.orderCount || 0),
      0
    );

    const recipesWithRatings = enrichedRecipes.filter(
      (recipe) => recipe.ratingCount > 0
    );

    const averageRating =
      recipesWithRatings.length > 0
        ? Math.round(
            (recipesWithRatings.reduce(
              (sum, recipe) => sum + recipe.averageRating,
              0
            ) /
              recipesWithRatings.length) *
              10
          ) / 10
        : 0;

    const myRecipeCount = enrichedRecipes.filter(
      (recipe) =>
        String(recipe.user?._id) === String(userId)
    ).length;

    const mapStatsRecipes = (items) =>
      items
        .slice(0, 4)
        .map((recipe) => mapRecipe(recipe));

    const mostOrdered = mapStatsRecipes(
      [...enrichedRecipes]
        .filter(
          (recipe) => Number(recipe.orderCount || 0) > 0
        )
        .sort(
          (a, b) =>
            Number(b.orderCount || 0) -
              Number(a.orderCount || 0) ||
            new Date(b.createdAt || 0) -
              new Date(a.createdAt || 0)
        )
    );

    const highestRated = mapStatsRecipes(
      [...enrichedRecipes]
        .filter((recipe) => recipe.ratingCount > 0)
        .sort(
          (a, b) =>
            (b.averageRating || 0) -
              (a.averageRating || 0) ||
            (b.ratingCount || 0) -
              (a.ratingCount || 0) ||
            new Date(b.createdAt || 0) -
              new Date(a.createdAt || 0)
        )
    );

    const trending = mapStatsRecipes(
      [...enrichedRecipes]
        .filter(
          (recipe) =>
            Number(recipe.orderCount || 0) > 0 &&
            recipe.lastOrderedAt &&
            new Date(recipe.lastOrderedAt) >= trendingCutoff
        )
        .sort(
          (a, b) =>
            new Date(b.lastOrderedAt || 0) -
              new Date(a.lastOrderedAt || 0) ||
            Number(b.orderCount || 0) -
              Number(a.orderCount || 0)
        )
    );

    const spicyFavorites = mapStatsRecipes(
      [...enrichedRecipes]
        .filter(
          (recipe) =>
            recipe.spiceLevel === "Hot" ||
            recipe.spiceLevel === "Very Hot"
        )
        .sort(
          (a, b) =>
            Number(b.orderCount || 0) -
              Number(a.orderCount || 0) ||
            new Date(b.createdAt || 0) -
              new Date(a.createdAt || 0)
        )
    );

    const sweetFavorites = mapStatsRecipes(
      [...enrichedRecipes]
        .filter(
          (recipe) =>
            recipe.sweetnessLevel === "Sweet" ||
            recipe.sweetnessLevel === "Very Sweet"
        )
        .sort(
          (a, b) =>
            Number(b.orderCount || 0) -
              Number(a.orderCount || 0) ||
            new Date(b.createdAt || 0) -
              new Date(a.createdAt || 0)
        )
    );

    const recentlyAdded = mapStatsRecipes(
      [...enrichedRecipes].sort(
        (a, b) =>
          new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0)
      )
    );

    return res.status(200).json({
      totals: {
        recipes: totalRecipes,
        orders: totalOrders,
        averageRating,
        mine: myRecipeCount,
      },
      mostOrdered,
      highestRated,
      trending,
      spicyFavorites,
      sweetFavorites,
      recentlyAdded,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRecipeStats,
};