const express = require("express");
const { body, param } = require("express-validator");

const {
  createCollection,
  getMyCollections,
  getCollectionById,
  addRecipeToCollection,
  removeRecipeFromCollection,
  updateCollectionCover,
  enableCollectionSharing,
  regenerateCollectionShare,
  disableCollectionSharing,
} = require("../controllers/collectionController");

const protect = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validationMiddleware");

const router = express.Router();

const collectionIdValidation = [
  param("id")
    .isMongoId()
    .withMessage("Invalid collection ID."),
];

const recipeIdParamValidation = [
  param("recipeId")
    .isMongoId()
    .withMessage("Invalid recipe ID."),
];

const createCollectionValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Collection name is required.")
    .isLength({ min: 2, max: 60 })
    .withMessage(
      "Collection name must be between 2 and 60 characters."
    ),
  body("description")
    .optional()
    .isString()
    .withMessage("Invalid collection description.")
    .trim()
    .isLength({ max: 200 })
    .withMessage("Description must be 200 characters or fewer."),
  coverImageValidation("coverImage", { optional: true }),
];

// Covers are Cloudinary URLs. An empty string is allowed on purpose so the
// owner can clear a cover again.
function coverImageValidation(field, { optional }) {
  const chain = body(field);

  if (optional) {
    chain.optional();
  }

  return chain
    .isString()
    .withMessage("Invalid cover image.")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Cover image URL is too long.")
    .custom((value) => value === "" || /^https?:\/\/\S+$/.test(value))
    .withMessage("Cover image must be a valid image URL.");
}

const updateCoverValidation = [
  coverImageValidation("coverImage", { optional: false }),
];

const addRecipeValidation = [
  body("recipeId")
    .isMongoId()
    .withMessage("Invalid recipe ID."),
];

// Every collection route is private to its owner.
router.use(protect);

router.get("/", getMyCollections);

router.post(
  "/",
  createCollectionValidation,
  validateRequest,
  createCollection
);

router.patch(
  "/:id/cover",
  collectionIdValidation,
  updateCoverValidation,
  validateRequest,
  updateCollectionCover
);

router.post(
  "/:id/share",
  collectionIdValidation,
  validateRequest,
  enableCollectionSharing
);

router.post(
  "/:id/share/regenerate",
  collectionIdValidation,
  validateRequest,
  regenerateCollectionShare
);

router.delete(
  "/:id/share",
  collectionIdValidation,
  validateRequest,
  disableCollectionSharing
);

router.get(
  "/:id",
  collectionIdValidation,
  validateRequest,
  getCollectionById
);

router.post(
  "/:id/recipes",
  collectionIdValidation,
  addRecipeValidation,
  validateRequest,
  addRecipeToCollection
);

router.delete(
  "/:id/recipes/:recipeId",
  collectionIdValidation,
  recipeIdParamValidation,
  validateRequest,
  removeRecipeFromCollection
);

module.exports = router;
