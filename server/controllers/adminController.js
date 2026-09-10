const Recipe = require("../models/Recipe");
const User = require("../models/User");

const TOP_ITEMS = 4;

const getAdminStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalRecipes,
      totalsAgg,
      recentUsers,
      recentRecipes,
      popularRecipes,
      topRatedRecipes,
    ] = await Promise.all([
      User.countDocuments(),
      Recipe.countDocuments(),
      Recipe.aggregate([
        {
          $group: {
            _id: null,
            orders: { $sum: "$orderCount" },
          },
        },
      ]),
      User.find()
        .sort({ createdAt: -1 })
        .limit(TOP_ITEMS)
        .select("name email role createdAt"),
      Recipe.find()
        .sort({ createdAt: -1 })
        .limit(TOP_ITEMS)
        .populate("user", "name email role"),
      Recipe.find({ orderCount: { $gt: 0 } })
        .sort({ orderCount: -1, createdAt: -1 })
        .limit(TOP_ITEMS)
        .populate("user", "name email role"),
      Recipe.find({ "ratings.0": { $exists: true } })
        .sort({ createdAt: -1 })
        .limit(TOP_ITEMS)
        .populate("user", "name email role"),
    ]);

    const withRatings = (recipes) =>
      recipes.map((recipe) => {
        const plain = recipe.toObject();
        const ratings = plain.ratings ?? [];
        const count = ratings.length;
        const average =
          count > 0
            ? Math.round(
                (ratings.reduce((sum, entry) => sum + entry.value, 0) / count) * 10
              ) / 10
            : 0;

        return {
          _id: plain._id,
          title: plain.title,
          category: plain.category,
          image: plain.image ?? "",
          spiceLevel: plain.spiceLevel,
          sweetnessLevel: plain.sweetnessLevel,
          orderCount: plain.orderCount ?? 0,
          rating: { average, count, mine: null },
          user: plain.user,
          createdAt: plain.createdAt,
        };
      });

    res.status(200).json({
      totals: {
        users: totalUsers,
        recipes: totalRecipes,
        orders: totalsAgg[0]?.orders ?? 0,
      },
      recentUsers,
      recentRecipes: withRatings(recentRecipes),
      popularRecipes: withRatings(popularRecipes),
      topRatedRecipes: withRatings(topRatedRecipes).sort(
        (a, b) => b.rating.average - a.rating.average
      ),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAdminStats };