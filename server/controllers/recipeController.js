const mongoose = require("mongoose");

const Recipe = require("../models/Recipe");
const User = require("../models/User");
const { evaluateCompatibility } = require("../utils/compatibility");

const SPICE_LEVELS = Recipe.SPICE_LEVELS;
const SWEETNESS_LEVELS = Recipe.SWEETNESS_LEVELS;

const TRENDING_WINDOW_DAYS = 14;

const getUserId = (req) =>
  req.user?.userId || req.user?.id || req.user?._id;

const mapRecipe = (doc, userId) => ({
  _id: doc._id,
  title: doc.title,
  category: doc.category,
  image: doc.image ?? "",
  spiceLevel: doc.spiceLevel ?? "Mild",
  sweetnessLevel: doc.sweetnessLevel ?? "Not Sweet",
  ingredients: doc.ingredients ?? [],
  steps: doc.steps ?? [],
  orderCount: doc.orderCount ?? 0,
  rating: {
    average: doc.averageRating ?? 0,
    count: doc.ratingCount ?? 0,
    mine: doc.myRating ?? null,
  },
  user: doc.user,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const summarizeRating = (recipe, userId) => {
  const ratings = recipe.ratings ?? [];
  const count = ratings.length;
  const average =
    count > 0
      ? Math.round((ratings.reduce((sum, entry) => sum + entry.value, 0) / count) * 10) / 10
      : 0;

  const mine = userId
    ? ratings.find((entry) => String(entry.user?._id ?? entry.user) === String(userId))
        ?.value ?? null
    : null;

  return { average, count, mine };
};

const toObjectId = (userId) =>
  userId && mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(String(userId))
    : null;

const buildFilter = (search, category) => {
  const filter = {};

  if (search.trim()) {
    const term = search.trim();
    filter.$or = [
      { title: { $regex: term, $options: "i" } },
      { category: { $regex: term, $options: "i" } },
      { ingredients: { $regex: term, $options: "i" } },
    ];
  }

  if (category.trim()) {
    filter.category = { $regex: category.trim(), $options: "i" };
  }

  return filter;
};

const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  popular: { orderCount: -1, createdAt: -1 },
  rating: { averageRating: -1, ratingCount: -1, createdAt: -1 },
  title: { title: 1 },
};

const buildEnrichedPipeline = (match, sortStage, limitSize, userObjectId) => {
  const stages = [
    { $match: match },
    {
      $addFields: {
        ratings: { $ifNull: ["$ratings", []] },
      },
    },
    {
      $addFields: {
        ratingCount: {
          $size: {
            $ifNull: ["$ratings", []],
          },
        },
        averageRating: {
          $cond: [
            {
              $gt: [
                {
                  $size: {
                    $ifNull: ["$ratings", []],
                  },
                },
                0,
              ],
            },
            {
              $round: [
                {
                  $avg: {
                    $map: {
                      input: {
                        $ifNull: ["$ratings", []],
                      },
                      as: "entry",
                      in: "$$entry.value",
                    },
                  },
                },
                1,
              ],
            },
            0,
          ],
        },
        myRating: userObjectId
          ? {
              $let: {
                vars: {
                  mine: {
                    $filter: {
                      input: {
                        $ifNull: ["$ratings", []],
                      },
                      as: "entry",
                      cond: { $eq: ["$$entry.user", userObjectId] },
                    },
                  },
                },
                in: {
                  $ifNull: [
                    { $arrayElemAt: ["$$mine.value", 0] },
                    null,
                  ],
                },
              },
            }
          : null,
      },
    },
  ];

  if (sortStage) {
    stages.push({ $sort: sortStage });
  }

  if (limitSize) {
    stages.push({ $limit: limitSize });
  }

  stages.push(
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        title: 1,
        category: 1,
        image: 1,
        ingredients: 1,
        steps: 1,
        spiceLevel: 1,
        sweetnessLevel: 1,
        orderCount: 1,
        lastOrderedAt: 1,
        createdAt: 1,
        updatedAt: 1,
        ratingCount: 1,
        averageRating: 1,
        myRating: 1,
        "user._id": 1,
        "user.name": 1,
        "user.email": 1,
        "user.role": 1,
      },
    }
  );

  return stages;
};

// GET /api/recipes
const getRecipes = async (req, res, next) => {
  try {
    const {
      search = "",
      category = "",
      sort = "newest",
      page = 1,
      limit = 10,
    } = req.query;

    const currentPage = Math.max(Number(page) || 1, 1);
    const pageLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const skip = (currentPage - 1) * pageLimit;

    const match = buildFilter(search, category);
    const sortStage = SORT_OPTIONS[sort] ?? SORT_OPTIONS.newest;
    const userObjectId = toObjectId(req.user?._id);

    const [docs, total] = await Promise.all([
      Recipe.aggregate(
        buildEnrichedPipeline(match, sortStage, null, userObjectId)
      )
        .skip(skip)
        .limit(pageLimit),
      Recipe.countDocuments(match),
    ]);

    res.status(200).json({
      recipes: docs.map((doc) => mapRecipe(doc, req.user?._id)),
      pagination: {
        page: currentPage,
        limit: pageLimit,
        total,
        totalPages: Math.ceil(total / pageLimit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/recipes/mine
const getMyRecipes = async (req, res, next) => {
  try {
    const userObjectId = toObjectId(req.user?._id);

    if (!userObjectId) {
      return res.status(401).json({
        message: "You need to sign in to see your recipes.",
      });
    }

    const docs = await Recipe.aggregate(
      buildEnrichedPipeline(
        { user: userObjectId },
        { createdAt: -1 },
        null,
        userObjectId
      )
    );

    res.status(200).json({
      recipes: docs.map((doc) => mapRecipe(doc, req.user?._id)),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/recipes/stats
const getRecipeStats = async (req, res, next) => {
  try {
    const userObjectId = toObjectId(req.user?._id);
    const trendingCutoff = new Date(
      Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );

    const section = (match, sortStage) =>
      Recipe.aggregate(
        buildEnrichedPipeline(match, sortStage, 4, userObjectId)
      ).then((docs) => docs.map((doc) => mapRecipe(doc, req.user?._id)));

    const [
      totalsAgg,
      ratingAgg,
      myRecipeCount,
      mostOrdered,
      highestRated,
      trending,
      spicyFavorites,
      sweetFavorites,
      recentlyAdded,
    ] = await Promise.all([
      Recipe.aggregate([
        {
          $group: {
            _id: null,
            recipes: { $sum: 1 },
            orders: { $sum: "$orderCount" },
          },
        },
      ]),
      Recipe.aggregate([
        {
          $addFields: {
            ratings: { $ifNull: ["$ratings", []] },
          },
        },
        {
          $project: {
            average: {
              $avg: {
                $map: {
                  input: "$ratings",
                  as: "entry",
                  in: "$$entry.value",
                },
              },
            },
          },
        },
        { $match: { average: { $gt: 0 } } },
        { $group: { _id: null, average: { $avg: "$average" } } },
      ]),
      Recipe.countDocuments({ user: userObjectId }),
      section(
        { orderCount: { $gt: 0 } },
        { orderCount: -1, createdAt: -1 }
      ),
      section(
        { ratings: { $type: "array", $ne: [] } },
        { averageRating: -1, ratingCount: -1, createdAt: -1 }
      ),
      section(
        { orderCount: { $gt: 0 }, lastOrderedAt: { $gte: trendingCutoff } },
        { lastOrderedAt: -1, orderCount: -1 }
      ),
      section(
        { spiceLevel: { $in: ["Hot", "Very Hot"] } },
        { orderCount: -1, createdAt: -1 }
      ),
      section(
        { sweetnessLevel: { $in: ["Sweet", "Very Sweet"] } },
        { orderCount: -1, createdAt: -1 }
      ),
      section({}, { createdAt: -1 }),
    ]);

    res.status(200).json({
      totals: {
        recipes: totalsAgg[0]?.recipes ?? 0,
        orders: totalsAgg[0]?.orders ?? 0,
        averageRating: ratingAgg[0]?.average
          ? Math.round(ratingAgg[0].average * 10) / 10
          : 0,
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

// GET /api/recipes/:id
const getRecipeById = async (req, res, next) => {
  try {
    const recipe = await Recipe.findById(req.params.id).populate(
      "user",
      "name email role"
    );

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    res.status(200).json({
      recipe: {
        ...recipe.toObject(),
        rating: summarizeRating(recipe, req.user?._id),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/recipes/:id/compatibility
const getRecipeCompatibility = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("preferences");
    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    res.status(200).json({
      compatibility: evaluateCompatibility(recipe, user.preferences),
    });
  } catch (error) {
    next(error);
  }
};

const validateRecipePayload = (payload) => {
  const { title, category, ingredients, steps, spiceLevel, sweetnessLevel } =
    payload;

  if (typeof title !== "string" || !title.trim()) {
    return "Recipe title is required.";
  }

  if (title.trim().length < 3 || title.trim().length > 100) {
    return "Recipe title must be between 3 and 100 characters.";
  }

  if (typeof category !== "string" || !category.trim()) {
    return "Recipe category is required.";
  }

  if (category.trim().length < 2 || category.trim().length > 50) {
    return "Recipe category must be between 2 and 50 characters.";
  }

  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return "At least one ingredient is required.";
  }

  if (!Array.isArray(steps) || steps.length === 0) {
    return "At least one preparation step is required.";
  }

  if (spiceLevel && !SPICE_LEVELS.includes(spiceLevel)) {
    return `Spice level must be one of: ${SPICE_LEVELS.join(", ")}.`;
  }

  if (sweetnessLevel && !SWEETNESS_LEVELS.includes(sweetnessLevel)) {
    return `Sweetness level must be one of: ${SWEETNESS_LEVELS.join(", ")}.`;
  }

  return null;
};

// POST /api/recipes
const createRecipe = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: "User authentication information is missing.",
      });
    }

    const {
      title,
      ingredients,
      steps,
      category,
      image,
      spiceLevel,
      sweetnessLevel,
    } = req.body;

    const validationError = validateRecipePayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const cleanIngredients = ingredients
      .map((item) => String(item).trim())
      .filter(Boolean);

    const cleanSteps = steps.map((item) => String(item).trim()).filter(Boolean);

    if (cleanIngredients.length === 0) {
      return res.status(400).json({
        message: "At least one valid ingredient is required.",
      });
    }

    if (cleanSteps.length === 0) {
      return res.status(400).json({
        message: "At least one valid preparation step is required.",
      });
    }

    const recipe = await Recipe.create({
      title: title.trim(),
      category: category.trim(),
      ingredients: cleanIngredients,
      steps: cleanSteps,
      image: typeof image === "string" ? image.trim() : "",
      spiceLevel: SPICE_LEVELS.includes(spiceLevel) ? spiceLevel : "Mild",
      sweetnessLevel: SWEETNESS_LEVELS.includes(sweetnessLevel)
        ? sweetnessLevel
        : "Not Sweet",
      user: userId,
    });

    const populated = await Recipe.findById(recipe._id).populate(
      "user",
      "name email role"
    );

    res.status(201).json({
      message: "Recipe created successfully",
      recipe: {
        ...populated.toObject(),
        rating: summarizeRating(populated, userId),
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/recipes/:id
const updateRecipe = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: "User authentication information is missing.",
      });
    }

    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    const isOwner = recipe.user.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: "You are not allowed to update this recipe.",
      });
    }

    const {
      title,
      ingredients,
      steps,
      category,
      image,
      spiceLevel,
      sweetnessLevel,
    } = req.body;

    const validationError = validateRecipePayload(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const cleanIngredients = ingredients
      .map((item) => String(item).trim())
      .filter(Boolean);

    const cleanSteps = steps.map((item) => String(item).trim()).filter(Boolean);

    if (cleanIngredients.length === 0) {
      return res.status(400).json({
        message: "At least one valid ingredient is required.",
      });
    }

    if (cleanSteps.length === 0) {
      return res.status(400).json({
        message: "At least one valid preparation step is required.",
      });
    }

    recipe.title = title.trim();
    recipe.category = category.trim();
    recipe.ingredients = cleanIngredients;
    recipe.steps = cleanSteps;
    recipe.image = typeof image === "string" ? image.trim() : recipe.image;

    if (spiceLevel && SPICE_LEVELS.includes(spiceLevel)) {
      recipe.spiceLevel = spiceLevel;
    }

    if (sweetnessLevel && SWEETNESS_LEVELS.includes(sweetnessLevel)) {
      recipe.sweetnessLevel = sweetnessLevel;
    }

    await recipe.save();

    const updatedRecipe = await Recipe.findById(recipe._id).populate(
      "user",
      "name email role"
    );

    res.status(200).json({
      message: "Recipe updated successfully",
      recipe: {
        ...updatedRecipe.toObject(),
        rating: summarizeRating(updatedRecipe, userId),
      },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/recipes/:id
const deleteRecipe = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: "User authentication information is missing.",
      });
    }

    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    const currentUser = await User.findById(userId);

    if (!currentUser) {
      return res.status(401).json({ message: "User not found" });
    }

    const isOwner = recipe.user.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: "You are not allowed to delete this recipe.",
      });
    }

    await Recipe.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: "Recipe deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/recipes/:id/rating
const rateRecipe = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: "You need to sign in to rate recipes.",
      });
    }

    const value = Number(req.body.value);

    if (!Number.isInteger(value) || value < 1 || value > 5) {
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

    const existing = recipe.ratings.find(
      (entry) => String(entry.user) === String(user._id)
    );

    if (existing) {
      existing.value = value;
    } else {
      recipe.ratings.push({ user: user._id, value });
    }

    await recipe.save();

    res.status(200).json({
      message: "Rating saved.",
      rating: summarizeRating(recipe, user._id),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/recipes/:id/order
const orderRecipe = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: "You need to sign in to place an order.",
      });
    }

    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    recipe.orderCount += 1;
    recipe.lastOrderedAt = new Date();

    await recipe.save();

    res.status(200).json({
      message: "Order placed. Enjoy your meal!",
      orderCount: recipe.orderCount,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRecipes,
  getMyRecipes,
  getRecipeStats,
  getRecipeById,
  getRecipeCompatibility,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  rateRecipe,
  orderRecipe,
};