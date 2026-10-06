const express = require("express");
const { body, param } = require("express-validator");

const {
  getMyProfile,
  updateMyProfile,
  getPublicProfile,
  getCreatorRecipes,
} = require("../controllers/profileController");

const protect = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validationMiddleware");

const router = express.Router();

const professionValidation = [
  body("profession")
    .optional()
    .isString()
    .withMessage("Invalid profession.")
    .trim()
    .isLength({ max: 100 })
    .withMessage("Profession must be 100 characters or fewer."),
];

// Profile photos are image URLs, same as recipe images and collection
// covers. An empty string is allowed so the photo can be cleared again.
const profilePhotoValidation = [
  body("profilePhoto")
    .optional()
    .isString()
    .withMessage("Invalid profile photo.")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Profile photo URL is too long.")
    .custom((value) => value === "" || /^https?:\/\/\S+$/.test(value))
    .withMessage("Profile photo must be a valid image URL."),
];

const updateProfileValidation = [
  ...professionValidation,
  ...profilePhotoValidation,
];

const userIdParamValidation = [
  param("userId")
    .isMongoId()
    .withMessage("Invalid user ID."),
];

// The signed-in user's own profile is always resolved from the JWT.
router
  .route("/me")
  .get(protect, getMyProfile)
  .patch(protect, updateProfileValidation, validateRequest, updateMyProfile)
  .put(protect, updateProfileValidation, validateRequest, updateMyProfile);

// Public creator profiles are read-only and require no authentication.
router.get(
  "/:userId/recipes",
  userIdParamValidation,
  validateRequest,
  getCreatorRecipes
);

router.get(
  "/:userId",
  userIdParamValidation,
  validateRequest,
  getPublicProfile
);

module.exports = router;
