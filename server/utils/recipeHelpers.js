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

const buildFilter = (search = "", category = "", mealCategory = "") => {
  const filter = {};

  if (search.trim()) {
    const term = escapeRegex(search.trim());

    filter.$or = [
      {
        title: {
          $regex: term,
          $options: "i",
        },
      },
      {
        category: {
          $regex: term,
          $options: "i",
        },
      },
      {
        ingredients: {
          $regex: term,
          $options: "i",
        },
      },
    ];
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

  return filter;
};

const validateRecipePayload = (payload) => {
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

  if (!CUISINES.includes(category.trim())) {
    return `Recipe category must be one of: ${CUISINES.join(", ")}.`;
  }

  if (typeof mealCategory !== "string" || !mealCategory.trim()) {
    return "Meal category is required.";
  }

  if (!MEAL_CATEGORIES.includes(mealCategory.trim())) {
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
  getUserId,
  mapRecipe,
  summarizeRating,
  toObjectId,
  buildFilter,
  validateRecipePayload,
  cleanRecipeArrays,
  SORT_OPTIONS,
  buildEnrichedPipeline,
};