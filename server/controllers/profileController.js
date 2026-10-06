const User = require("../models/User");
const Recipe = require("../models/Recipe");
const {
  mapRecipe,
  summarizeRating,
} = require("../utils/recipeHelpers");

// Fields a user is allowed to change on their own creator profile. Anything
// else in the request body (ids, role, password, ...) is ignored so a client
// can never write outside of its own account.
const UPDATABLE_FIELDS = ["profession", "profilePhoto"];

const buildProfile = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  profession: user.profession || "",
  profilePhoto: user.profilePhoto || "",
});

// @desc    Get the signed-in user's own profile
// @route   GET /api/profiles/me
const getMyProfile = async (req, res) => {
  // req.user is loaded by the auth middleware from the verified JWT, so the
  // identity always comes from the token and never from the request body.
  return res.status(200).json({
    profile: buildProfile(req.user),
  });
};

// @desc    Update the signed-in user's own profile
// @route   PATCH /api/profiles/me
// @route   PUT /api/profiles/me
const updateMyProfile = async (req, res, next) => {
  try {
    const updates = {};

    for (const field of UPDATABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No updatable profile fields were provided.",
      });
    }

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    ).select("-password");

    if (!updated) {
      return res.status(401).json({
        message: "Not authorized. User no longer exists.",
      });
    }

    return res.status(200).json({
      message: "Profile updated successfully.",
      profile: buildProfile(updated),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a user's public creator profile
// @route   GET /api/profiles/:userId
const getPublicProfile = async (req, res, next) => {
  try {
    // Explicit projection: only the fields that are safe to show publicly
    // are ever loaded from the database.
    const user = await User.findById(req.params.userId).select(
      "_id name profession profilePhoto"
    );

    if (!user) {
      return res.status(404).json({
        message: "Profile not found.",
      });
    }

    return res.status(200).json({
      profile: {
        _id: user._id,
        name: user.name,
        profession: user.profession || "",
        profilePhoto: user.profilePhoto || "",
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a creator's public recipes
// @route   GET /api/profiles/:userId/recipes
const getCreatorRecipes = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select("_id");

    if (!user) {
      return res.status(404).json({
        message: "Profile not found.",
      });
    }

    const recipes = await Recipe.find({
      user: user._id,
    })
      // Only the public display name travels with each card; email, role
      // and the password never leave the database here.
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .lean();

    const mappedRecipes = recipes.map((recipe) => {
      const rating = summarizeRating(recipe, null);

      return mapRecipe({
        ...recipe,
        averageRating: rating.average,
        ratingCount: rating.count,
        myRating: rating.mine,
      });
    });

    return res.status(200).json({
      recipes: mappedRecipes,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  getPublicProfile,
  getCreatorRecipes,
};
