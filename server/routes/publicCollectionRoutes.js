const express = require("express");
const { param } = require("express-validator");

const {
  getSharedCollection,
} = require("../controllers/collectionController");

const validateRequest = require("../middleware/validationMiddleware");

const router = express.Router();

// Share tokens are URL-safe random strings. Anything else is rejected before
// the database is queried, and the endpoint itself is read-only.
const shareTokenValidation = [
  param("token")
    .isString()
    .trim()
    .matches(/^[A-Za-z0-9_-]{20,64}$/)
    .withMessage("Invalid share link."),
];

router.get(
  "/collections/:token",
  shareTokenValidation,
  validateRequest,
  getSharedCollection
);

module.exports = router;
