const User = require("../models/User");
const Recipe = require("../models/Recipe");

const {
  parseMessage,
  mergePreferences,
  describeChanges,
  FOOD_DISCLAIMER,
} = require("../utils/assistantEngine");
const { evaluateCompatibility } = require("../utils/compatibility");

// POST /api/assistant/chat
const sendChatMessage = async (req, res, next) => {
  try {
    const { message } = req.body;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        message: "Tell me something about your food preferences first.",
      });
    }

    const user = await User.findById(req.user._id);
    const { updates, spiceLevel, sweetnessLevel } = parseMessage(message);

    const applied = {
      allergies: updates.allergies,
      avoid: updates.avoidIngredients,
      preferred: updates.preferredIngredients,
      spice: spiceLevel ?? "",
      sweetness: sweetnessLevel ?? "",
    };

    const mergedPreferences = mergePreferences(
      user.preferences ?? {},
      updates,
      spiceLevel,
      sweetnessLevel
    );

    const changedSomething =
      applied.allergies.length > 0 ||
      applied.avoid.length > 0 ||
      applied.preferred.length > 0 ||
      Boolean(spiceLevel) ||
      Boolean(sweetnessLevel);

    if (changedSomething) {
      await User.findByIdAndUpdate(req.user._id, {
        $set: {
          "preferences.allergies": mergedPreferences.allergies,
          "preferences.avoidIngredients": mergedPreferences.avoidIngredients,
          "preferences.preferredIngredients":
            mergedPreferences.preferredIngredients,
          "preferences.dietaryPreferences": mergedPreferences.dietaryPreferences,
          "preferences.spiceLevel": mergedPreferences.spiceLevel,
          "preferences.sweetnessLevel": mergedPreferences.sweetnessLevel,
        },
      });
    }

    const recipes = await Recipe.find()
      .sort({ orderCount: -1, createdAt: -1 })
      .limit(30)
      .populate("user", "name email role");

    const evaluated = recipes.map((recipe) => ({
      recipe: recipe.toObject(),
      ...evaluateCompatibility(recipe, mergedPreferences),
    }));

    const levelRank = { good: 0, match: 1, caution: 2, conflict: 3 };

    const matches = evaluated
      .sort((a, b) => levelRank[a.level] - levelRank[b.level])
      .slice(0, 6)
      .map((entry) => ({
        recipeId: entry.recipe._id,
        title: entry.recipe.title,
        level: entry.level,
        reasons: entry.reasons,
        spiceLevel: entry.recipe.spiceLevel,
        sweetnessLevel: entry.recipe.sweetnessLevel,
      }));

    const conflicts = evaluated.filter((entry) => entry.level === "conflict");
    const good = evaluated.filter(
      (entry) => entry.level === "good" || entry.level === "match"
    );

    const replyParts = [];

    if (changedSomething) {
      replyParts.push("Got it. I've saved this to your private food profile.");
      replyParts.push(...describeChanges(applied, mergedPreferences));
    } else {
      replyParts.push(
        'Here is what I found for you. Tell me things like "I am allergic to peanuts", "I don\'t want onion" or "I prefer less spicy food" and I\'ll keep your profile updated.'
      );
    }

    if (good.length > 0) {
      replyParts.push(
        `${good.length} of the ${evaluated.length} recipes available look like a good fit for your saved preferences.`
      );
    }

    if (conflicts.length > 0) {
      replyParts.push(
        `${conflicts.length} recipe${conflicts.length === 1 ? "" : "s"} may not suit you because of the ingredients you asked me to watch out for.`
      );
    }

    replyParts.push(FOOD_DISCLAIMER);

    res.status(200).json({
      reply: replyParts.join(" "),
      preferences: mergedPreferences,
      matches,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { sendChatMessage };