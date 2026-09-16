const express = require("express");
const { body, param } = require("express-validator");

const {
  createRecipe,
  getRecipes,
  getMyRecipes,
  getRecipeStats,
  getRecipeById,
  getRecipeCompatibility,
  updateRecipe,
  deleteRecipe,
  rateRecipe,
  orderRecipe,
} = require("../controllers/recipeController");

const { CUISINES, MEAL_CATEGORIES } = require("../models/Recipe");

const protect = require("../middleware/authMiddleware");
const optionalAuth = require("../middleware/optionalAuth");
const validateRequest = require("../middleware/validationMiddleware");

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
    .isIn(CUISINES)
    .withMessage(`Category must be one of: ${CUISINES.join(", ")}.`),

  body("mealCategory")
    .trim()
    .notEmpty()
    .withMessage("Meal category is required.")
    .isIn(MEAL_CATEGORIES)
    .withMessage(
      `Meal category must be one of: ${MEAL_CATEGORIES.join(", ")}.`
    ),

  body("image")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Image URL must be at most 500 characters."),
];

const recipeIdValidation = [
  param("id")
    .isMongoId()
    .withMessage("Invalid recipe ID."),
];

const ratingValidation = [
  body("value")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5."),
];

router
  .route("/")
  .get(optionalAuth, getRecipes)
  .post(
    protect,
    recipeValidationRules,
    validateRequest,
    createRecipe
  );

router.get("/stats", protect, getRecipeStats);
router.get("/mine", protect, getMyRecipes);

router
  .route("/:id")
  .get(optionalAuth, getRecipeById)
  .put(
    protect,
    recipeIdValidation,
    recipeValidationRules,
    validateRequest,
    updateRecipe
  )
  .delete(
    protect,
    recipeIdValidation,
    validateRequest,
    deleteRecipe
  );

router.post(
  "/:id/rating",
  protect,
  recipeIdValidation,
  ratingValidation,
  validateRequest,
  rateRecipe
);

router.post(
  "/:id/order",
  protect,
  recipeIdValidation,
  validateRequest,
  orderRecipe
);

router.get(
  "/:id/compatibility",
  protect,
  recipeIdValidation,
  validateRequest,
  getRecipeCompatibility
);

module.exports = router;