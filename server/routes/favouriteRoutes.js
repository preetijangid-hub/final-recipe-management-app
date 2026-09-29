const express = require("express");
const { param } = require("express-validator");

const {
  getMyFavourites,
  addFavourite,
  removeFavourite,
} = require("../controllers/favouriteController");

const protect = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validationMiddleware");

const router = express.Router();

const recipeIdParamValidation = [
  param("recipeId")
    .isMongoId()
    .withMessage("Invalid recipe ID."),
];

// Every favourites route belongs to the signed-in user.
router.use(protect);

router.get("/", getMyFavourites);

router.post(
  "/:recipeId",
  recipeIdParamValidation,
  validateRequest,
  addFavourite
);

router.delete(
  "/:recipeId",
  recipeIdParamValidation,
  validateRequest,
  removeFavourite
);

module.exports = router;
