const { normalizeText } = require("./normalize");

const SPICE_RANK = ["mild", "medium", "hot", "very hot"];
const SWEETNESS_RANK = ["not sweet", "lightly sweet", "sweet", "very sweet"];

const rankOf = (value, scale) => {
  const normalized = normalizeText(value);
  const index = scale.indexOf(normalized);
  return index;
};

const evaluateCompatibility = (recipe, preferences) => {
  const reasons = [];
  let level = "match";

  const recipeIngredients = (recipe.ingredients ?? []).map((ingredient) =>
    normalizeText(ingredient)
  );

  const findIngredient = (needle) =>
    recipeIngredients.find((ingredient) => ingredient.includes(needle));

  for (const allergy of preferences?.allergies ?? []) {
    const matched = findIngredient(normalizeText(allergy));

    if (matched) {
      level = "conflict";
      reasons.push(`Contains ${matched}, which you marked as an allergy.`);
    }
  }

  for (const item of preferences?.avoidIngredients ?? []) {
    const matched = findIngredient(normalizeText(item));

    if (matched) {
      if (level !== "conflict") {
        level = "caution";
      }

      reasons.push(`Contains ${matched}, which is on your avoid list.`);
    }
  }

  for (const item of preferences?.preferredIngredients ?? []) {
    const matched = findIngredient(normalizeText(item));

    if (matched && level === "match") {
      level = "good";
    }

    if (matched) {
      reasons.push(`Matches your preference for ${matched}.`);
    }
  }

  const preferredSpice = rankOf(preferences?.spiceLevel, SPICE_RANK);
  const recipeSpice = rankOf(recipe.spiceLevel, SPICE_RANK);

  if (preferredSpice > -1 && recipeSpice > -1) {
    if (recipeSpice > preferredSpice) {
      if (level === "match") {
        level = "caution";
      }

      reasons.push(
        `Spice level (${recipe.spiceLevel}) is higher than your ${preferences.spiceLevel} preference.`
      );
    } else if (recipeSpice === preferredSpice) {
      reasons.push(`Matches your ${preferences.spiceLevel} spice preference.`);
    }
  }

  const preferredSweetness = rankOf(
    preferences?.sweetnessLevel,
    SWEETNESS_RANK
  );
  const recipeSweetness = rankOf(recipe.sweetnessLevel, SWEETNESS_RANK);

  if (preferredSweetness > -1 && recipeSweetness > -1) {
    if (recipeSweetness > preferredSweetness) {
      if (level === "match") {
        level = "caution";
      }

      reasons.push(
        `Sweetness (${recipe.sweetnessLevel}) is higher than your ${preferences.sweetnessLevel} preference.`
      );
    } else if (recipeSweetness === preferredSweetness) {
      reasons.push(
        `Matches your ${preferences.sweetnessLevel} sweetness preference.`
      );
    }
  }

  return { level, reasons };
};

module.exports = { evaluateCompatibility };