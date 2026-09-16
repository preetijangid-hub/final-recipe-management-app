const Recipe = require("../models/Recipe");
const User = require("../models/User");
const { evaluateCompatibility } = require("../utils/compatibility");
const { getRecipeStats } = require("./recipeStatsController");

const {
  SPICE_LEVELS,
  SWEETNESS_LEVELS,
  getUserId,
  mapRecipe,
  summarizeRating,
  toObjectId,
  buildFilter,
  validateRecipePayload,
  cleanRecipeArrays,
  SORT_OPTIONS,
  buildEnrichedPipeline,
} = require("../utils/recipeHelpers");

// GET /api/recipes
const getRecipes = async (req, res, next) => {
  try {
    const {
      search = "",
      category = "",
      mealCategory = "",
      sort = "newest",
      page = 1,
      limit = 10,
    } = req.query;

    const currentPage = Math.max(Number(page) || 1, 1);

    const pageLimit = Math.min(
      Math.max(Number(limit) || 10, 1),
      50
    );

    const skip = (currentPage - 1) * pageLimit;

    const match = buildFilter(
      search,
      category,
      mealCategory
    );

    const sortStage =
      SORT_OPTIONS[sort] ?? SORT_OPTIONS.newest;

    const userObjectId = toObjectId(
      req.user?._id
    );

    const [docs, total] = await Promise.all([
      Recipe.aggregate(
        buildEnrichedPipeline(
          match,
          sortStage,
          null,
          userObjectId
        )
      )
        .skip(skip)
        .limit(pageLimit),

      Recipe.countDocuments(match),
    ]);

    return res.status(200).json({
      recipes: docs.map((doc) => mapRecipe(doc)),

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
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        message: "You need to sign in to see your recipes.",
      });
    }

    const recipes = await Recipe.find({
      user: userId,
    })
      .populate("user", "name email role")
      .sort({
        createdAt: -1,
      })
      .lean();

    const mappedRecipes = recipes.map((recipe) => {
      const rating = summarizeRating(
        recipe,
        userId
      );

      return mapRecipe({
        ...recipe,
        averageRating: rating.average,
        ratingCount: rating.count,
        myRating: rating.mine,
      });
    });

    return res.status(200).json({
      recipes: mappedRecipes,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/recipes/stats
// Stats logic is kept in a dedicated controller.

// GET /api/recipes/:id
const getRecipeById = async (req, res, next) => {
  try {
    const recipe = await Recipe.findById(
      req.params.id
    ).populate(
      "user",
      "name email role"
    );

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    return res.status(200).json({
      recipe: {
        ...recipe.toObject(),
        mealCategory: recipe.mealCategory ?? "",
        rating: summarizeRating(
          recipe,
          req.user?._id
        ),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/recipes/:id/compatibility
const getRecipeCompatibility = async (
  req,
  res,
  next
) => {
  try {
    const user = await User.findById(
      req.user._id
    ).select("preferences");

    const recipe = await Recipe.findById(
      req.params.id
    );

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    return res.status(200).json({
      compatibility: evaluateCompatibility(
        recipe,
        user?.preferences
      ),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/recipes
const createRecipe = async (
  req,
  res,
  next
) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message:
          "User authentication information is missing.",
      });
    }

    const {
      title,
      ingredients,
      steps,
      category,
      mealCategory,
      image,
      spiceLevel,
      sweetnessLevel,
    } = req.body;

    const validationError =
      validateRecipePayload(req.body);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const cleaned = cleanRecipeArrays(
      ingredients,
      steps
    );

    if (cleaned.error) {
      return res.status(400).json({
        message: cleaned.error,
      });
    }

    const recipe = await Recipe.create({
      title: title.trim(),
      category: category.trim(),
      mealCategory: mealCategory.trim(),
      ingredients: cleaned.cleanIngredients,
      steps: cleaned.cleanSteps,
      image:
        typeof image === "string"
          ? image.trim()
          : "",
      spiceLevel:
        SPICE_LEVELS.includes(spiceLevel)
          ? spiceLevel
          : "Mild",
      sweetnessLevel:
        SWEETNESS_LEVELS.includes(
          sweetnessLevel
        )
          ? sweetnessLevel
          : "Not Sweet",
      user: userId,
    });

    const populated = await Recipe.findById(
      recipe._id
    ).populate(
      "user",
      "name email role"
    );

    return res.status(201).json({
      message: "Recipe created successfully",
      recipe: {
        ...populated.toObject(),
        rating: summarizeRating(
          populated,
          userId
        ),
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/recipes/:id
const updateRecipe = async (
  req,
  res,
  next
) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message:
          "User authentication information is missing.",
      });
    }

    const recipe = await Recipe.findById(
      req.params.id
    );

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    const currentUser = await User.findById(
      userId
    );

    if (!currentUser) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    const isOwner =
      recipe.user.toString() ===
      currentUser._id.toString();

    const isAdmin =
      currentUser.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message:
          "You are not allowed to update this recipe.",
      });
    }

    const {
      title,
      ingredients,
      steps,
      category,
      mealCategory,
      image,
      spiceLevel,
      sweetnessLevel,
    } = req.body;

    const validationError =
      validateRecipePayload(req.body);

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const cleaned = cleanRecipeArrays(
      ingredients,
      steps
    );

    if (cleaned.error) {
      return res.status(400).json({
        message: cleaned.error,
      });
    }

    recipe.title = title.trim();
    recipe.category = category.trim();
    recipe.mealCategory = mealCategory.trim();
    recipe.ingredients =
      cleaned.cleanIngredients;
    recipe.steps = cleaned.cleanSteps;

    if (typeof image === "string") {
      recipe.image = image.trim();
    }

    if (
      spiceLevel &&
      SPICE_LEVELS.includes(spiceLevel)
    ) {
      recipe.spiceLevel = spiceLevel;
    }

    if (
      sweetnessLevel &&
      SWEETNESS_LEVELS.includes(
        sweetnessLevel
      )
    ) {
      recipe.sweetnessLevel =
        sweetnessLevel;
    }

    await recipe.save();

    const updatedRecipe =
      await Recipe.findById(
        recipe._id
      ).populate(
        "user",
        "name email role"
      );

    return res.status(200).json({
      message: "Recipe updated successfully",
      recipe: {
        ...updatedRecipe.toObject(),
        rating: summarizeRating(
          updatedRecipe,
          userId
        ),
      },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/recipes/:id
const deleteRecipe = async (
  req,
  res,
  next
) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message:
          "User authentication information is missing.",
      });
    }

    const recipe = await Recipe.findById(
      req.params.id
    );

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    const currentUser = await User.findById(
      userId
    );

    if (!currentUser) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    const isOwner =
      recipe.user.toString() ===
      currentUser._id.toString();

    const isAdmin =
      currentUser.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message:
          "You are not allowed to delete this recipe.",
      });
    }

    await Recipe.findByIdAndDelete(
      req.params.id
    );

    return res.status(200).json({
      message: "Recipe deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/recipes/:id/rating
const rateRecipe = async (
  req,
  res,
  next
) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message:
          "You need to sign in to rate recipes.",
      });
    }

    const value = Number(
      req.body.value
    );

    if (
      !Number.isInteger(value) ||
      value < 1 ||
      value > 5
    ) {
      return res.status(400).json({
        message:
          "Rating must be a whole number between 1 and 5.",
      });
    }

    const recipe = await Recipe.findById(
      req.params.id
    );

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    const existing =
      recipe.ratings.find(
        (entry) =>
          String(entry.user) ===
          String(user._id)
      );

    if (existing) {
      existing.value = value;
    } else {
      recipe.ratings.push({
        user: user._id,
        value,
      });
    }

    await recipe.save();

    return res.status(200).json({
      message: "Rating saved.",
      rating: summarizeRating(
        recipe,
        user._id
      ),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/recipes/:id/order
const orderRecipe = async (
  req,
  res,
  next
) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message:
          "You need to sign in to place an order.",
      });
    }

    const recipe = await Recipe.findById(
      req.params.id
    );

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    recipe.orderCount += 1;
    recipe.lastOrderedAt = new Date();

    await recipe.save();

    return res.status(200).json({
      message:
        "Order placed. Enjoy your meal!",
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
