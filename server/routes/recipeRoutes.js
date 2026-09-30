const express = require("express");
const { body, param } = require("express-validator");

const {
  createRecipe,
  getRecipes,
  getMyRecipes,
  getRecipeStats,
  getTrendingThisWeek,
  getRecipeById,
  getRecipeCompatibility,
  updateRecipe,
  deleteRecipe,
  rateRecipe,
  orderRecipe,
} = require("../controllers/recipeController");

const { CUISINES, MEAL_CATEGORIES } = require("../models/Recipe");
const { SENTIMENTS } = require("../models/Review");

const {
  createReview,
  getRecipeReviews,
  getReviewSummary,
  deleteReview,
} = require("../controllers/reviewController");

const protect = require("../middleware/authMiddleware");
const optionalAuth = require("../middleware/optionalAuth");
const validateRequest = require("../middleware/validationMiddleware");

const router = express.Router();

const recipeFieldRules = [
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

  body("image")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Image URL must be at most 500 characters."),

  // Optional smart search fields. They may be omitted, sent as null or sent
  // as an empty string, in which case the recipe simply has no description
  // or cooking time.
  body("description")
    .custom(
      (value) =>
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim().length <= 500)
    )
    .withMessage(
      "Recipe description must be text of at most 500 characters."
    ),

  body("cookingTime")
    .custom((value) => {
      if (value === undefined || value === null || value === "") {
        return true;
      }

      const minutes = Number(value);

      return Number.isInteger(minutes) && minutes >= 1 && minutes <= 600;
    })
    .withMessage(
      "Cooking time must be a whole number of minutes between 1 and 600."
    ),
];

// New recipes must pick from the cuisine list. Updates keep whatever category
// older recipes already store, so they only require a plain non-empty value.
const recipeCategoryRules = [
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
];

const recipeUpdateCategoryRules = [
  body("category")
    .trim()
    .notEmpty()
    .withMessage("Category is required.")
    .isLength({ min: 2, max: 50 })
    .withMessage("Category must be between 2 and 50 characters."),

  body("mealCategory")
    .trim()
    .notEmpty()
    .withMessage("Meal category is required.")
    .isLength({ min: 2, max: 50 })
    .withMessage("Meal category must be between 2 and 50 characters."),
];

const recipeValidationRules = [...recipeFieldRules, ...recipeCategoryRules];

const recipeUpdateValidationRules = [
  ...recipeFieldRules,
  ...recipeUpdateCategoryRules,
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

const reviewIdValidation = [
  param("reviewId")
    .isMongoId()
    .withMessage("Invalid review ID."),
];

const reviewValidationRules = [
  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be a whole number between 1 and 5."),

  body("comment")
    .trim()
    .notEmpty()
    .withMessage("Review comment is required.")
    .isLength({ min: 3, max: 1000 })
    .withMessage("Review comment must be between 3 and 1000 characters."),

  body("sentiment")
    .optional()
    .isIn(SENTIMENTS)
    .withMessage(`Sentiment must be one of: ${SENTIMENTS.join(", ")}.`),
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

// Public, read-only list of the recipes collecting the most reviews this
// week. It has to be registered before "/:id" so "trending" is not treated
// as a recipe id.
router.get("/trending", optionalAuth, getTrendingThisWeek);

router
  .route("/:id")
  .get(optionalAuth, getRecipeById)
  .put(
    protect,
    recipeIdValidation,
    recipeUpdateValidationRules,
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

router.get(
  "/:id/reviews",
  optionalAuth,
  recipeIdValidation,
  validateRequest,
  getRecipeReviews
);

router.get(
  "/:id/reviews/summary",
  optionalAuth,
  recipeIdValidation,
  validateRequest,
  getReviewSummary
);

router.post(
  "/:id/reviews",
  protect,
  recipeIdValidation,
  reviewValidationRules,
  validateRequest,
  createReview
);

router.delete(
  "/:id/reviews/:reviewId",
  protect,
  recipeIdValidation,
  reviewIdValidation,
  validateRequest,
  deleteReview
);

module.exports = router;