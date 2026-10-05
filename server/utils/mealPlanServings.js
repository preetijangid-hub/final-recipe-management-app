const getRecipeServingsValue = (servingsByRecipe, recipeId) => {
  if (!servingsByRecipe || !recipeId) {
    return null;
  }

  const key = String(recipeId);
  const value = servingsByRecipe instanceof Map ? servingsByRecipe.get(key) : servingsByRecipe[key];

  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 20 ? parsed : null;
};

// Servings are stored per recipe so two recipes sharing a meal slot never
// overwrite each other. The legacy slot-level `servings` value is only used as
// the fallback for recipes that were saved before per-recipe servings existed.
const resolveRecipeServings = (mealPlan, recipeId) => {
  const perRecipe = getRecipeServingsValue(mealPlan?.servingsByRecipe, recipeId);

  if (perRecipe !== null) {
    return perRecipe;
  }

  const slotLevel = Number(mealPlan?.servings);
  return Number.isInteger(slotLevel) && slotLevel >= 1 && slotLevel <= 20 ? slotLevel : 1;
};

const toServingsRecord = (servingsByRecipe) => {
  if (!servingsByRecipe) {
    return {};
  }

  if (typeof servingsByRecipe.entries === "function") {
    return Object.fromEntries(servingsByRecipe.entries());
  }

  return { ...servingsByRecipe };
};

module.exports = {
  getRecipeServingsValue,
  resolveRecipeServings,
  toServingsRecord,
};