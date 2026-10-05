const MealPlan = require("../models/MealPlan");
const ShoppingList = require("../models/ShoppingList");
const { aggregateIngredientList } = require("../utils/ingredientAggregation");
const { resolveRecipeServings } = require("../utils/mealPlanServings");

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getStartOfWeek = (targetDate = new Date()) => {
  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);

  const offsetToMonday = (start.getDay() + 6) % 7;
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
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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

const toDisplayItem = (item, existingChecked = false) => ({
  name: item.name,
  quantity: Number(item.quantity) || 0,
  unit: item.unit || "",
  kind: item.kind || "count",
  checked: Boolean(existingChecked),
  normalizedName: item.normalizedName || item.name.toLowerCase(),
  usedIn: Array.isArray(item.usedIn) ? item.usedIn : [],
});

const buildShoppingListForWeek = async (userId, weekStart, previousDoc = null) => {
  const weekEnd = getEndOfWeek(weekStart);
  const checkedByName = new Map();

  if (previousDoc && Array.isArray(previousDoc.items)) {
    for (const item of previousDoc.items) {
      checkedByName.set(String(item.normalizedName || item.name).toLowerCase(), Boolean(item.checked));
    }
  }

  const mealPlans = await MealPlan.find({
    user: userId,
    date: {
      $gte: weekStart,
      $lte: weekEnd,
    },
  })
    .populate({
      path: "recipes",
      select: "title ingredients user",
    })
    .populate({
      path: "recipe",
      select: "title ingredients user",
    })
    .lean();

  const aggregateMap = new Map();

  for (const mealPlan of mealPlans) {
    const recipeDocs = Array.isArray(mealPlan.recipes) && mealPlan.recipes.length > 0
      ? mealPlan.recipes
      : mealPlan.recipe
        ? [mealPlan.recipe]
        : [];

    for (const recipe of recipeDocs) {
      if (!recipe || !Array.isArray(recipe.ingredients)) {
        continue;
      }

      const recipeTitle = String(recipe.title || "Recipe").trim() || "Recipe";

      // Each recipe scales by its own serving count, so two recipes sharing a
      // meal slot are never inflated by one shared slot-level value.
      const scale = resolveRecipeServings(mealPlan, recipe._id);
      const aggregatedEntries = aggregateIngredientList(recipe.ingredients, scale);

      for (const entry of aggregatedEntries) {
        const key = `${entry.kind}:${entry.name.toLowerCase()}`;
        const current = aggregateMap.get(key) || {
          name: entry.name,
          quantity: 0,
          unit: entry.unit || "",
          kind: entry.kind,
          normalizedName: entry.name.toLowerCase(),
          usedIn: new Set(),
        };

        current.quantity += Number(entry.quantity) || 0;
        current.usedIn.add(recipeTitle);
        aggregateMap.set(key, current);
      }
    }
  }

  const items = Array.from(aggregateMap.values())
    .map((item) => {
      const normalizedName = String(item.normalizedName || item.name).toLowerCase();
      const checked = Boolean(checkedByName.get(normalizedName));
      return toDisplayItem(
        {
          name: item.name,
          quantity: item.quantity,
          unit: item.unit || "",
          kind: item.kind || "count",
          normalizedName,
          usedIn: Array.from(item.usedIn || []).sort(),
        },
        checked
      );
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  return items;
};

const getShoppingList = async (req, res, next) => {
  try {
    const weekStart = req.query.weekStart || getStartOfWeek();

    if (!isValidDateKey(weekStart)) {
      return res.status(400).json({
        message: "weekStart must be a valid date in YYYY-MM-DD format.",
      });
    }

    const existingDoc = await ShoppingList.findOne({
      user: req.user._id,
      weekStart,
    }).lean();

    const items = await buildShoppingListForWeek(req.user._id, weekStart, existingDoc);

    const shoppingList = await ShoppingList.findOneAndUpdate(
      { user: req.user._id, weekStart },
      {
        user: req.user._id,
        weekStart,
        items,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      weekStart,
      weekEnd: getEndOfWeek(weekStart),
      shoppingList,
    });
  } catch (error) {
    next(error);
  }
};

const refreshShoppingList = async (req, res, next) => {
  try {
    const weekStart = req.body.weekStart || req.query.weekStart || getStartOfWeek();

    if (!isValidDateKey(weekStart)) {
      return res.status(400).json({
        message: "weekStart must be a valid date in YYYY-MM-DD format.",
      });
    }

    const existingDoc = await ShoppingList.findOne({
      user: req.user._id,
      weekStart,
    }).lean();

    const items = await buildShoppingListForWeek(req.user._id, weekStart, existingDoc);

    const shoppingList = await ShoppingList.findOneAndUpdate(
      { user: req.user._id, weekStart },
      { user: req.user._id, weekStart, items },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      message: "Shopping list refreshed.",
      shoppingList,
    });
  } catch (error) {
    next(error);
  }
};

const toggleShoppingListItem = async (req, res, next) => {
  try {
    const { itemName, checked } = req.body;
    const { id } = req.params;

    if (!itemName || typeof itemName !== "string") {
      return res.status(400).json({
        message: "itemName is required.",
      });
    }

    const shoppingList = await ShoppingList.findOne({ _id: id, user: req.user._id });

    if (!shoppingList) {
      return res.status(404).json({
        message: "Shopping list not found.",
      });
    }

    const normalizedName = itemName.trim().toLowerCase();
    const nextChecked = Boolean(checked);

    shoppingList.items = shoppingList.items.map((item) => {
      if ((item.normalizedName || item.name).toLowerCase() === normalizedName) {
        return {
          ...item.toObject(),
          checked: nextChecked,
        };
      }

      return item;
    });

    await shoppingList.save();

    return res.status(200).json({
      message: "Shopping list item updated.",
      shoppingList,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getShoppingList,
  refreshShoppingList,
  toggleShoppingListItem,
  buildShoppingListForWeek,
  getStartOfWeek,
  getEndOfWeek,
  isValidDateKey,
};
