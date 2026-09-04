const { validationResult } = require("express-validator");
const Recipe = require("../models/Recipe");

const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: "Validation failed.",
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg
      }))
    });
  }

  return null;
};

const createRecipe = async (req, res, next) => {
  try {
    const validationError = handleValidationErrors(req, res);

    if (validationError) {
      return;
    }

    const { title, ingredients, steps, category } = req.body;

    const recipe = await Recipe.create({
      title: title.trim(),
      ingredients: ingredients.map((ingredient) => ingredient.trim()),
      steps: steps.map((step) => step.trim()),
      category: category.trim(),
      user: req.user._id
    });

    return res.status(201).json({
      message: "Recipe created successfully.",
      recipe
    });
  } catch (error) {
    next(error);
  }
};

const getRecipes = async (req, res, next) => {
  try {
    const recipes = await Recipe.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: recipes.length,
      recipes
    });
  } catch (error) {
    next(error);
  }
};

const getRecipeById = async (req, res, next) => {
  try {
    const validationError = handleValidationErrors(req, res);

    if (validationError) {
      return;
    }

    const recipe = await Recipe.findById(req.params.id)
      .populate("user", "name email");

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found."
      });
    }

    return res.status(200).json({
      recipe
    });
  } catch (error) {
    next(error);
  }
};

const updateRecipe = async (req, res, next) => {
  try {
    const validationError = handleValidationErrors(req, res);

    if (validationError) {
      return;
    }

    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found."
      });
    }

    const isOwner = recipe.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: "You do not have permission to update this recipe."
      });
    }

    const { title, ingredients, steps, category } = req.body;

    recipe.title = title.trim();
    recipe.ingredients = ingredients.map((ingredient) => ingredient.trim());
    recipe.steps = steps.map((step) => step.trim());
    recipe.category = category.trim();

    await recipe.save();

    return res.status(200).json({
      message: "Recipe updated successfully.",
      recipe
    });
  } catch (error) {
    next(error);
  }
};

const deleteRecipe = async (req, res, next) => {
  try {
    const validationError = handleValidationErrors(req, res);

    if (validationError) {
      return;
    }

    const recipe = await Recipe.findById(req.params.id);

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found."
      });
    }

    const isOwner = recipe.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        message: "You do not have permission to delete this recipe."
      });
    }

    await recipe.deleteOne();

    return res.status(200).json({
      message: "Recipe deleted successfully."
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRecipe,
  getRecipes,
  getRecipeById,
  updateRecipe,
  deleteRecipe
};