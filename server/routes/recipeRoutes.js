const express = require("express");
const { body, param } = require("express-validator");

const {
  createRecipe,
  getRecipes,
  getRecipeById,
  updateRecipe,
  deleteRecipe
} = require("../controllers/recipeController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

const recipeValidationRules = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required.")
    .isLength({ min: 3, max: 100 })
    .withMessage("Title must be between 3 and 100 characters."),

  body("ingredients")
    .isArray({ min: 1 })
    .withMessage("At least one ingredient is required."),

  body("ingredients.*")
    .trim()
    .notEmpty()
    .withMessage("Each ingredient must be a non-empty string."),

  body("steps")
    .isArray({ min: 1 })
    .withMessage("At least one preparation step is required."),

  body("steps.*")
    .trim()
    .notEmpty()
    .withMessage("Each step must be a non-empty string."),

  body("category")
    .trim()
    .notEmpty()
    .withMessage("Category is required.")
    .isLength({ min: 2, max: 50 })
    .withMessage("Category must be between 2 and 50 characters.")
];

const recipeIdValidation = [
  param("id")
    .isMongoId()
    .withMessage("Invalid recipe ID.")
];

router
  .route("/")
  .get(getRecipes)
  .post(protect, recipeValidationRules, createRecipe);

router
  .route("/:id")
  .get(recipeIdValidation, getRecipeById)
  .put(
    protect,
    recipeIdValidation,
    recipeValidationRules,
    updateRecipe
  )
  .delete(
    protect,
    recipeIdValidation,
    deleteRecipe
  );

module.exports = router;