const MealPlan = require("../models/MealPlan");
const Recipe = require("../models/Recipe");
const { resolveRecipeServings, toServingsRecord } = require("../utils/mealPlanServings");

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MEAL_TYPES = ["breakfast", "lunch", "dinner"];

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getStartOfWeek = (targetDate = new Date()) => {
  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);

  const dayIndex = start.getDay();
  const offsetToMonday = (dayIndex + 6) % 7;
  start.setDate(start.getDate() - offsetToMonday);

  return formatDateKey(start);
};

const getEndOfWeek = (weekStartKey) => {
  const start = new Date(`${weekStartKey}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return formatDateKey(end);
};

const isValidDateKey = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
};

const normalizeMealType = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
};

const normalizeRecipeRefs = (mealPlan) => {
  const refs = [];
  const seen = new Set();

  const addRef = (recipeRef) => {
    if (!recipeRef) {
      return;
    }

    const refId = recipeRef._id || recipeRef;
    const normalizedId = String(refId);

    if (!normalizedId || seen.has(normalizedId)) {
      return;
    }

    seen.add(normalizedId);
    refs.push(refId);
  };

  if (Array.isArray(mealPlan?.recipes)) {
    mealPlan.recipes.forEach(addRef);
  }

  if (mealPlan?.recipe) {
    addRef(mealPlan.recipe);
  }

  return refs;
};

const buildRecipePayload = (recipe) => {
  if (!recipe) {
    return null;
  }

  return {
    _id: recipe._id || recipe,
    title: recipe.title || "Recipe",
    image: recipe.image || "",
    category: recipe.category || "",
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
    user: recipe.user,
  };
};

const buildMealPlanResponse = (mealPlan) => {
  const recipeDocs = Array.isArray(mealPlan.recipes)
    ? mealPlan.recipes
    : mealPlan.recipe
      ? [mealPlan.recipe]
      : [];

  const recipes = recipeDocs.map(buildRecipePayload).filter(Boolean);

  return {
    _id: mealPlan._id,
    user: mealPlan.user,
    date: mealPlan.date,
    mealType: mealPlan.mealType,
    servings: mealPlan.servings ?? 1,
    servingsByRecipe: toServingsRecord(mealPlan.servingsByRecipe),
    recipes,
    recipe: recipes[0] ?? null,
    createdAt: mealPlan.createdAt,
    updatedAt: mealPlan.updatedAt,
  };
};

const getMealPlansForWeek = async (req, res, next) => {
  try {
    const queryWeekStart = req.query.weekStart || getStartOfWeek();

    if (!isValidDateKey(queryWeekStart)) {
      return res.status(400).json({
        message: "weekStart must be a valid date in YYYY-MM-DD format.",
      });
    }

    const weekEnd = getEndOfWeek(queryWeekStart);

    const mealPlans = await MealPlan.find({
      user: req.user._id,
      date: {
        $gte: queryWeekStart,
        $lte: weekEnd,
      },
    })
      .sort({ date: 1, mealType: 1 })
      .populate({
        path: "recipe",
        select: "title image category ingredients steps user",
      })
      .populate({
        path: "recipes",
        select: "title image category ingredients steps user",
      })
      .lean();

    return res.status(200).json({
      weekStart: queryWeekStart,
      weekEnd,
      mealPlans: mealPlans.map(buildMealPlanResponse),
      weekdayNames: DAY_NAMES,
      mealTypes: MEAL_TYPES,
    });
  } catch (error) {
    next(error);
  }
};

const upsertMealPlan = async (req, res, next) => {
  try {
    const { date, mealType, recipe: recipeId, servings } = req.body;

    if (!isValidDateKey(date)) {
      return res.status(400).json({
        message: "Date is required and must be in YYYY-MM-DD format.",
      });
    }

    const normalizedMealType = normalizeMealType(mealType);

    if (!MEAL_TYPES.includes(normalizedMealType)) {
      return res.status(400).json({
        message: "Meal type must be one of: breakfast, lunch, dinner.",
      });
    }

    const parsedServings = Number(servings ?? 1);
    if (!Number.isInteger(parsedServings) || parsedServings < 1 || parsedServings > 20) {
      return res.status(400).json({
        message: "Servings must be a whole number between 1 and 20.",
      });
    }

    const recipe = await Recipe.findById(recipeId);

    if (!recipe) {
      return res.status(404).json({
        message: "Recipe not found.",
      });
    }

    let mealPlan = await MealPlan.findOne({
      user: req.user._id,
      date,
      mealType: normalizedMealType,
    });

    if (mealPlan) {
      const recipeRefs = normalizeRecipeRefs(mealPlan);
      const recipeRefId = String(recipe._id);

      if (!recipeRefs.some((ref) => String(ref) === recipeRefId)) {
        recipeRefs.push(recipe._id);
      }

      mealPlan.recipes = recipeRefs;
      mealPlan.recipe = recipe._id;

      // Servings belong to the recipe being saved. Writing the shared
      // slot-level field here would silently change the servings of every
      // other recipe in the same slot.
      mealPlan.servingsByRecipe.set(recipeRefId, parsedServings);

      if (mealPlan.servingsByRecipe.size === 1) {
        mealPlan.servings = parsedServings;
      }

      mealPlan = await mealPlan.save();
    } else {
      mealPlan = await MealPlan.create({
        user: req.user._id,
        date,
        mealType: normalizedMealType,
        recipe: recipe._id,
        recipes: [recipe._id],
        servings: parsedServings,
        servingsByRecipe: new Map([[String(recipe._id), parsedServings]]),
      });
    }

    await mealPlan.populate({
      path: "recipes",
      select: "title image category ingredients steps user",
    });

    return res.status(201).json({
      message: "Meal plan saved.",
      mealPlan: buildMealPlanResponse(mealPlan.toObject ? mealPlan.toObject() : mealPlan),
    });
  } catch (error) {
    next(error);
  }
};

const removeRecipeFromMealPlan = async (req, res, next) => {
  try {
    const mealPlan = await MealPlan.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!mealPlan) {
      return res.status(404).json({
        message: "Meal plan entry not found.",
      });
    }

    const remainingRecipes = normalizeRecipeRefs(mealPlan).filter(
      (ref) => String(ref) !== String(req.params.recipeId)
    );

    if (remainingRecipes.length === 0) {
      await MealPlan.findByIdAndDelete(mealPlan._id);

      return res.status(200).json({
        message: "Recipe removed from meal plan.",
        emptied: true,
        mealPlan: null,
      });
    }

    mealPlan.recipes = remainingRecipes;
    mealPlan.recipe = remainingRecipes[0];

    // Drop the serving count that belonged to the removed recipe so it cannot
    // resurface if the same recipe is planned in that slot again later.
    mealPlan.servingsByRecipe.delete(String(req.params.recipeId));

    if (mealPlan.servingsByRecipe.size === 0) {
      const nextRecipeId = String(remainingRecipes[0]);
      mealPlan.servingsByRecipe.set(nextRecipeId, resolveRecipeServings(mealPlan, nextRecipeId));
    }

    if (mealPlan.servingsByRecipe.size <= 1) {
      const [remainingRecipeId] = mealPlan.servingsByRecipe.keys();
      mealPlan.servings = mealPlan.servingsByRecipe.get(remainingRecipeId) ?? mealPlan.servings;
    }

    await mealPlan.save();
    await mealPlan.populate({
      path: "recipes",
      select: "title image category ingredients steps user",
    });

    return res.status(200).json({
      message: "Recipe removed from meal plan.",
      emptied: false,
      mealPlan: buildMealPlanResponse(mealPlan.toObject ? mealPlan.toObject() : mealPlan),
    });
  } catch (error) {
    next(error);
  }
};

const deleteMealPlan = async (req, res, next) => {
  try {
    const deletedPlan = await MealPlan.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!deletedPlan) {
      return res.status(404).json({
        message: "Meal plan entry not found.",
      });
    }

    return res.status(200).json({
      message: "Meal plan entry removed.",
      id: deletedPlan._id,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMealPlansForWeek,
  upsertMealPlan,
  removeRecipeFromMealPlan,
  deleteMealPlan,
  isValidDateKey,
  getStartOfWeek,
  getEndOfWeek,
};
