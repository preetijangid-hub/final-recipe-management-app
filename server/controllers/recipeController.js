const mongoose = require("mongoose");
const Recipe = require("../models/Recipe");
const User = require("../models/User");

// Get logged-in user's ID from JWT middleware
const getUserId = (req) => {
  return (
    req.user?.userId ||
    req.user?.id ||
    req.user?._id
  );
};

// GET /api/recipes
const getRecipes = async (req, res, next) => {
  try {
    const {
      search = "",
      category = "",
      page = 1,
      limit = 10,
    } = req.query;

    const currentPage = Math.max(
      Number(page) || 1,
      1
    );

    const pageLimit = Math.min(
      Math.max(Number(limit) || 10, 1),
      50
    );

    const skip =
      (currentPage - 1) * pageLimit;

    const query = {};

    if (search.trim()) {
      query.$or = [
        {
          title: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          category: {
            $regex: search.trim(),
            $options: "i",
          },
        },
      ];
    }

    if (category.trim()) {
      query.category = {
        $regex: category.trim(),
        $options: "i",
      };
    }

    const [recipes, total] =
      await Promise.all([
        Recipe.find(query)
          .populate("user", "name email role")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageLimit),

        Recipe.countDocuments(query),
      ]);

    res.status(200).json({
      recipes,
      pagination: {
        page: currentPage,
        limit: pageLimit,
        total,
        totalPages:
          Math.ceil(total / pageLimit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/recipes/:id
const getRecipeById = async (
  req,
  res,
  next
) => {
  try {
    const recipe =
      await Recipe.findById(
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

    res.status(200).json({
      recipe,
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

    if (
      !mongoose.Types.ObjectId.isValid(
        userId
      )
    ) {
      return res.status(401).json({
        message:
          "Invalid authenticated user ID.",
      });
    }

    const {
      title,
      ingredients,
      steps,
      category,
    } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim()
    ) {
      return res.status(400).json({
        message:
          "Recipe title is required.",
      });
    }

    if (
      typeof category !== "string" ||
      !category.trim()
    ) {
      return res.status(400).json({
        message:
          "Recipe category is required.",
      });
    }

    if (
      !Array.isArray(ingredients) ||
      ingredients.length === 0
    ) {
      return res.status(400).json({
        message:
          "At least one ingredient is required.",
      });
    }

    if (
      !Array.isArray(steps) ||
      steps.length === 0
    ) {
      return res.status(400).json({
        message:
          "At least one preparation step is required.",
      });
    }

    const cleanIngredients =
      ingredients
        .map((item) => String(item).trim())
        .filter(Boolean);

    const cleanSteps =
      steps
        .map((item) => String(item).trim())
        .filter(Boolean);

    if (cleanIngredients.length === 0) {
      return res.status(400).json({
        message:
          "At least one valid ingredient is required.",
      });
    }

    if (cleanSteps.length === 0) {
      return res.status(400).json({
        message:
          "At least one valid preparation step is required.",
      });
    }

    const user =
      await User.findById(userId);

    if (!user) {
      return res.status(401).json({
        message:
          "Authenticated user was not found.",
      });
    }

    const recipe =
      await Recipe.create({
        title: title.trim(),
        ingredients: cleanIngredients,
        steps: cleanSteps,
        category: category.trim(),
        user: user._id,
      });

    const populatedRecipe =
      await Recipe.findById(
        recipe._id
      ).populate(
        "user",
        "name email role"
      );

    res.status(201).json({
      message:
        "Recipe created successfully",
      recipe: populatedRecipe,
    });
  } catch (error) {
    console.error(
      "CREATE RECIPE ERROR:",
      error
    );

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

    const recipe =
      await Recipe.findById(
        req.params.id
      );

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    const currentUser =
      await User.findById(userId);

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
    } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim()
    ) {
      return res.status(400).json({
        message:
          "Recipe title is required.",
      });
    }

    if (
      typeof category !== "string" ||
      !category.trim()
    ) {
      return res.status(400).json({
        message:
          "Recipe category is required.",
      });
    }

    if (
      !Array.isArray(ingredients) ||
      ingredients.length === 0
    ) {
      return res.status(400).json({
        message:
          "At least one ingredient is required.",
      });
    }

    if (
      !Array.isArray(steps) ||
      steps.length === 0
    ) {
      return res.status(400).json({
        message:
          "At least one preparation step is required.",
      });
    }

    const cleanIngredients =
      ingredients
        .map((item) => String(item).trim())
        .filter(Boolean);

    const cleanSteps =
      steps
        .map((item) => String(item).trim())
        .filter(Boolean);

    if (cleanIngredients.length === 0) {
      return res.status(400).json({
        message:
          "At least one valid ingredient is required.",
      });
    }

    if (cleanSteps.length === 0) {
      return res.status(400).json({
        message:
          "At least one valid preparation step is required.",
      });
    }

    recipe.title = title.trim();
    recipe.category = category.trim();
    recipe.ingredients =
      cleanIngredients;
    recipe.steps = cleanSteps;

    await recipe.save();

    const updatedRecipe =
      await Recipe.findById(
        recipe._id
      ).populate(
        "user",
        "name email role"
      );

    res.status(200).json({
      message:
        "Recipe updated successfully",
      recipe: updatedRecipe,
    });
  } catch (error) {
    console.error(
      "UPDATE RECIPE ERROR:",
      error
    );

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

    const recipe =
      await Recipe.findById(
        req.params.id
      );

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found",
      });
    }

    const currentUser =
      await User.findById(userId);

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

    res.status(200).json({
      message:
        "Recipe deleted successfully",
    });
  } catch (error) {
    console.error(
      "DELETE RECIPE ERROR:",
      error
    );

    next(error);
  }
};

module.exports = {
  getRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
};