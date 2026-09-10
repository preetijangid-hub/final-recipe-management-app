const User = require("../models/User");
const Recipe = require("../models/Recipe");

const { normalizeList } = require("../utils/normalize");
const { evaluateCompatibility } = require("../utils/compatibility");

const ALLERGY_PATTERNS = [
  /i(?:'m| am)\s+allergic\s+to\s+(.+)/,
  /allerg(?:y|ic)\s*(?:to|:)\s+(.+)/,
  /(?:can'?t|cannot|can not|won'?t)\s+eat\s+(.+)/,
];

const AVOID_PATTERNS = [
  /(?:don'?t|do not)\s+(?:want|eat|have)\s+(?:any\s+)?(.+)/,
  /(?:avoid|skip|exclude)\s+(.+)/,
  /(?:no|nothing with)\s+(.+)/,
];

const PREFER_PATTERNS = [
  /(?:i\s+)?(?:prefer|want|like|love|add)\s+(?:more\s+)?(.+)/,
];

const SPICE_HINTS = [
  { keywords: ["very hot", "extra hot", "spiciest", "max spice"], value: "Very Hot" },
  { keywords: ["spicy", "hot food", "spice lover"], value: "Hot" },
  { keywords: ["medium spice", "medium"], value: "Medium" },
  { keywords: ["less spicy", "not spicy", "mild", "low spice"], value: "Mild" },
];

const SWEETNESS_HINTS = [
  { keywords: ["very sweet", "sweetest"], value: "Very Sweet" },
  { keywords: ["not sweet", "no sugar", "less sweet", "unsweetened"], value: "Not Sweet" },
  { keywords: ["lightly sweet", "slightly sweet", "a little sweet"], value: "Lightly Sweet" },
  { keywords: ["sweet tooth", "sweet"], value: "Sweet" },
];

const FOOD_DISCLAIMER =
  "I only look at the ingredients listed in each recipe. Please verify ingredients and cross-contamination information yourself, and talk to a medical professional about any allergy. I can't diagnose or confirm anything medical.";

const extractItems = (phrase) =>
  phrase
    .split(/,| and | & /)
    .map((item) =>
      item
        .replace(/^(?:any|a|an|the|some|my)\s+/, "")
        .replace(/\s+(?:please|thanks|thank you)\b.*$/, "")
        .replace(/[.!]+$/, "")
        .trim()
    )
    .filter((item) => item.length > 1);

const matchHint = (text, hints) => {
  for (const hint of hints) {
    for (const keyword of hint.keywords) {
      const pattern = new RegExp(`\\b${keyword}\\b`);

      if (pattern.test(text)) {
        return hint.value;
      }
    }
  }

  return null;
};

const parseMessage = (message) => {
  const text = message.trim().toLowerCase();
  const updates = {
    allergies: [],
    avoidIngredients: [],
    preferredIngredients: [],
  };
  let spiceLevel;
  let sweetnessLevel;

  for (const pattern of ALLERGY_PATTERNS) {
    const match = text.match(pattern);

    if (match) {
      updates.allergies.push(...extractItems(match[1]));
      break;
    }
  }

  if (updates.allergies.length === 0) {
    for (const pattern of AVOID_PATTERNS) {
      const match = text.match(pattern);

      if (match) {
        updates.avoidIngredients.push(...extractItems(match[1]));
        break;
      }
    }
  }

  sweetnessLevel = matchHint(text, SWEETNESS_HINTS);
  spiceLevel = matchHint(text, SPICE_HINTS);

  if (!spiceLevel && !sweetnessLevel && updates.allergies.length === 0) {
    for (const pattern of PREFER_PATTERNS) {
      const match = text.match(pattern);

      if (match) {
        updates.preferredIngredients.push(...extractItems(match[1]));
        break;
      }
    }
  }

  return { updates, spiceLevel, sweetnessLevel };
};

const mergePreferences = (current, updates, spiceLevel, sweetnessLevel) => ({
  allergies: normalizeList([...(current.allergies ?? []), ...updates.allergies]),
  avoidIngredients: normalizeList([
    ...(current.avoidIngredients ?? []),
    ...updates.avoidIngredients,
  ]),
  preferredIngredients: normalizeList([
    ...(current.preferredIngredients ?? []),
    ...updates.preferredIngredients,
  ]),
  dietaryPreferences: current.dietaryPreferences ?? [],
  spiceLevel: spiceLevel ?? current.spiceLevel ?? "",
  sweetnessLevel: sweetnessLevel ?? current.sweetnessLevel ?? "",
});

const describeChanges = (applied, preferences) => {
  const lines = [];

  if (applied.allergies.length) {
    lines.push(`Allergies noted: ${applied.allergies.join(", ")}.`);
  }

  if (applied.avoid.length) {
    lines.push(`Avoiding: ${applied.avoid.join(", ")}.`);
  }

  if (applied.preferred.length) {
    lines.push(`Preferred ingredients: ${applied.preferred.join(", ")}.`);
  }

  if (applied.spice) {
    lines.push(`Spice preference set to ${preferences.spiceLevel}.`);
  }

  if (applied.sweetness) {
    lines.push(`Sweetness preference set to ${preferences.sweetnessLevel}.`);
  }

  return lines;
};

module.exports = { parseMessage, mergePreferences, describeChanges, FOOD_DISCLAIMER };