const mongoose = require("mongoose");
const Recipe = require("../models/Recipe");

const SPICE_LEVELS = Recipe.SPICE_LEVELS;
const SWEETNESS_LEVELS = Recipe.SWEETNESS_LEVELS;
const CUISINES = Recipe.CUISINES;
const MEAL_CATEGORIES = Recipe.MEAL_CATEGORIES;

const getUserId = (req) =>
  req.user?.userId || req.user?.id || req.user?._id;

const mapRecipe = (doc) => ({
  _id: doc._id,
  title: doc.title,
  description: doc.description ?? "",
  cookingTime: doc.cookingTime ?? null,
  category: doc.category,
  mealCategory: doc.mealCategory ?? "",
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
      ? Math.round(
          (ratings.reduce(
            (sum, entry) => sum + Number(entry.value || 0),
            0
          ) /
            count) *
            10
        ) / 10
      : 0;

  const mine = userId
    ? ratings.find(
        (entry) =>
          String(entry.user?._id ?? entry.user) === String(userId)
      )?.value ?? null
    : null;

  return {
    average,
    count,
    mine,
  };
};

const toObjectId = (userId) =>
  userId && mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(String(userId))
    : null;

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Bounds for the smart search filters. Values outside these ranges are
// ignored instead of failing the request, so a stray query string can
// never break recipe browsing.
const MAX_COOKING_TIME_MINUTES = 600;
const MAX_INGREDIENT_FILTERS = 10;

const parseIngredientFilter = (value) => {
  const raw = Array.isArray(value) ? value : String(value ?? "").split(",");

  const ingredients = raw
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0)
    .map((item) => item.slice(0, 50));

  // Duplicates would only repeat the same condition in the query.
  return [...new Set(ingredients)].slice(0, MAX_INGREDIENT_FILTERS);
};

const parseMaxCookingTime = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const minutes = Number(value);

  if (
    !Number.isFinite(minutes) ||
    minutes < 1 ||
    minutes > MAX_COOKING_TIME_MINUTES
  ) {
    return null;
  }

  return Math.round(minutes);
};

const parseMinRating = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const rating = Number(value);

  if (!Number.isFinite(rating) || rating <= 0 || rating > 5) {
    return null;
  }

  return Math.round(rating * 10) / 10;
};

// Turns the raw query string of GET /api/recipes into the filter values the
// search box, the sorting control and the "Cook With What I Have" picker use.
const parseSearchFilters = (query = {}) => ({
  ingredients: parseIngredientFilter(query.ingredients),
  maxCookingTime: parseMaxCookingTime(query.maxCookingTime),
  minRating: parseMinRating(query.minRating),
});

const buildFilter = (
  search = "",
  category = "",
  mealCategory = "",
  filters = {}
) => {
  const filter = {};

  const ingredients = filters.ingredients ?? [];
  const maxCookingTime = filters.maxCookingTime ?? null;
  const minRating = filters.minRating ?? null;

  // Text search runs through the compound text index on title,
  // description and ingredients. Extra whitespace is collapsed because the
  // index tokenises on single spaces.
  if (search.trim()) {
    filter.$text = {
      $search: search.trim().replace(/\s+/g, " "),
    };
  }

  if (category.trim()) {
    filter.category = {
      $regex: escapeRegex(category.trim()),
      $options: "i",
    };
  }

  if (mealCategory.trim()) {
    filter.mealCategory = {
      $regex: escapeRegex(mealCategory.trim()),
      $options: "i",
    };
  }

  // "Cook With What I Have": every picked ingredient has to be present,
  // which is what $all checks on the ingredients array.
  if (ingredients.length > 0) {
    filter.ingredients = {
      $all: ingredients.map(
        (item) => new RegExp(escapeRegex(item), "i")
      ),
    };
  }

  // Recipes without a cooking time simply do not match this filter.
  if (maxCookingTime) {
    filter.cookingTime = {
      $lte: maxCookingTime,
    };
  }

  // The average is computed inside the query so recipes without any
  // rating are left out instead of being counted as zero stars.
  if (minRating) {
    filter.$expr = {
      $gte: [
        {
          $ifNull: [
            {
              $avg: "$ratings.value",
            },
            0,
          ],
        },
        minRating,
      ],
    };
  }

  return filter;
};

const validateRecipePayload = (payload, isUpdate = false) => {
  const {
    title,
    category,
    mealCategory,
    ingredients,
    steps,
    spiceLevel,
    sweetnessLevel,
  } = payload;

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

  if (!isUpdate && !CUISINES.includes(category.trim())) {
    return `Recipe category must be one of: ${CUISINES.join(", ")}.`;
  }

  if (typeof mealCategory !== "string" || !mealCategory.trim()) {
    return "Meal category is required.";
  }

  if (!isUpdate && !MEAL_CATEGORIES.includes(mealCategory.trim())) {
    return `Meal category must be one of: ${MEAL_CATEGORIES.join(", ")}.`;
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

  return validateOptionalSearchFields(payload);
};

// Optional fields are only checked when the client sends them, so older
// clients that know nothing about them keep working.
const validateOptionalSearchFields = (payload = {}) => {
  const { description, cookingTime } = payload;

  if (description !== undefined && description !== null) {
    if (typeof description !== "string") {
      return "Recipe description must be text.";
    }

    if (description.trim().length > 500) {
      return "Recipe description must be at most 500 characters.";
    }
  }

  if (
    cookingTime !== undefined &&
    cookingTime !== null &&
    cookingTime !== ""
  ) {
    const minutes = Number(cookingTime);

    if (
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > MAX_COOKING_TIME_MINUTES
    ) {
      return `Cooking time must be a whole number of minutes between 1 and ${MAX_COOKING_TIME_MINUTES}.`;
    }
  }

  return null;
};

const cleanRecipeArrays = (ingredients, steps) => {
  const cleanIngredients = ingredients
    .map((item) => String(item).trim())
    .filter(Boolean);

  const cleanSteps = steps
    .map((item) => String(item).trim())
    .filter(Boolean);

  if (cleanIngredients.length === 0) {
    return {
      error: "At least one valid ingredient is required.",
    };
  }

  if (cleanSteps.length === 0) {
    return {
      error: "At least one valid preparation step is required.",
    };
  }

  return {
    cleanIngredients,
    cleanSteps,
  };
};

const SORT_OPTIONS = {
  newest: {
    createdAt: -1,
  },
  oldest: {
    createdAt: 1,
  },
  popular: {
    orderCount: -1,
    createdAt: -1,
  },
  rating: {
    averageRating: -1,
    ratingCount: -1,
    createdAt: -1,
  },
  reviewed: {
    ratingCount: -1,
    averageRating: -1,
    createdAt: -1,
  },
  cookingTimeAsc: {
    cookingTime: 1,
    createdAt: -1,
  },
  cookingTimeDesc: {
    cookingTime: -1,
    createdAt: -1,
  },
  title: {
    title: 1,
  },
};

const buildEnrichedPipeline = (
  match,
  sortStage,
  limitSize,
  userObjectId
) => {
  const stages = [
    {
      $match: match,
    },
    {
      $addFields: {
        ratings: {
          $ifNull: ["$ratings", []],
        },
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
                      cond: {
                        $eq: ["$$entry.user", userObjectId],
                      },
                    },
                  },
                },
                in: {
                  $ifNull: [
                    {
                      $arrayElemAt: ["$$mine.value", 0],
                    },
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
    stages.push({
      $sort: sortStage,
    });
  }

  if (limitSize) {
    stages.push({
      $limit: limitSize,
    });
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
    {
      $unwind: "$user",
    },
    {
      $project: {
        title: 1,
        description: 1,
        cookingTime: 1,
        category: 1,
        mealCategory: 1,
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

module.exports = {
  SPICE_LEVELS,
  SWEETNESS_LEVELS,
  MAX_COOKING_TIME_MINUTES,
  getUserId,
  mapRecipe,
  summarizeRating,
  toObjectId,
  buildFilter,
  parseSearchFilters,
  validateRecipePayload,
  cleanRecipeArrays,
  SORT_OPTIONS,
  buildEnrichedPipeline,
};