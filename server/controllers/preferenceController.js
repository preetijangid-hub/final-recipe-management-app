const User = require("../models/User");

const { normalizeList } = require("../utils/normalize");
const { SPICE_LEVELS, SWEETNESS_LEVELS } = require("../models/Recipe");

const emptyPreferences = () => ({
  allergies: [],
  avoidIngredients: [],
  preferredIngredients: [],
  dietaryPreferences: [],
  spiceLevel: "",
  sweetnessLevel: "",
});

const normalizePreferences = (preferences) => ({
  allergies: normalizeList(preferences?.allergies ?? []),
  avoidIngredients: normalizeList(preferences?.avoidIngredients ?? []),
  preferredIngredients: normalizeList(preferences?.preferredIngredients ?? []),
  dietaryPreferences: normalizeList(preferences?.dietaryPreferences ?? []),
  spiceLevel: SPICE_LEVELS.includes(preferences?.spiceLevel ?? "")
    ? preferences.spiceLevel
    : "",
  sweetnessLevel: SWEETNESS_LEVELS.includes(preferences?.sweetnessLevel ?? "")
    ? preferences.sweetnessLevel
    : "",
});

// GET /api/preferences
const getPreferences = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("preferences");

    res.status(200).json({
      preferences: normalizePreferences(user?.preferences),
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/preferences
const updatePreferences = async (req, res, next) => {
  try {
    const {
      allergies,
      avoidIngredients,
      preferredIngredients,
      dietaryPreferences,
      spiceLevel,
      sweetnessLevel,
    } = req.body;

    if (spiceLevel && !SPICE_LEVELS.includes(spiceLevel)) {
      return res.status(400).json({
        message: `Spice level must be one of: ${SPICE_LEVELS.join(", ")}.`,
      });
    }

    if (sweetnessLevel && !SWEETNESS_LEVELS.includes(sweetnessLevel)) {
      return res.status(400).json({
        message: `Sweetness level must be one of: ${SWEETNESS_LEVELS.join(", ")}.`,
      });
    }

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          "preferences.allergies": normalizeList(allergies),
          "preferences.avoidIngredients": normalizeList(avoidIngredients),
          "preferences.preferredIngredients": normalizeList(preferredIngredients),
          "preferences.dietaryPreferences": normalizeList(dietaryPreferences),
          "preferences.spiceLevel": SPICE_LEVELS.includes(spiceLevel ?? "")
            ? spiceLevel
            : "",
          "preferences.sweetnessLevel": SWEETNESS_LEVELS.includes(
            sweetnessLevel ?? ""
          )
            ? sweetnessLevel
            : "",
        },
      },
      { new: true }
    ).select("preferences");

    res.status(200).json({
      message: "Food preferences saved.",
      preferences: normalizePreferences(updated?.preferences),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getPreferences, updatePreferences, emptyPreferences };