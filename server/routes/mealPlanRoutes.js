const express = require("express");
const { body, param } = require("express-validator");

const {
  getMealPlansForWeek,
  upsertMealPlan,
  removeRecipeFromMealPlan,
  deleteMealPlan,
} = require("../controllers/mealPlanController");
const protect = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validationMiddleware");

const router = express.Router();

const mealPlanValidation = [
  body("date")
    .trim()
    .notEmpty()
    .withMessage("Date is required.")
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Date must be in YYYY-MM-DD format."),

  body("mealType")
    .trim()
    .notEmpty()
    .withMessage("Meal type is required.")
    .isIn(["breakfast", "lunch", "dinner"])
    .withMessage("Meal type must be breakfast, lunch or dinner."),

  body("recipe")
    .notEmpty()
    .withMessage("Recipe is required."),

  body("servings")
    .optional()
    .custom((value) => {
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed >= 1 && parsed <= 20;
    })
    .withMessage("Servings must be a whole number between 1 and 20."),
];

const mealPlanIdValidation = [
  param("id")
    .isMongoId()
    .withMessage("Invalid meal plan ID."),
];

router.use(protect);

router
  .route("/")
  .get(getMealPlansForWeek)
  .post(mealPlanValidation, validateRequest, upsertMealPlan);

router.delete(
  "/:id",
  mealPlanIdValidation,
  validateRequest,
  deleteMealPlan
);

router.delete(
  "/:id/recipes/:recipeId",
  mealPlanIdValidation,
  validateRequest,
  removeRecipeFromMealPlan
);

module.exports = router;
