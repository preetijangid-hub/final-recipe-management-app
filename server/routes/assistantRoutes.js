const express = require("express");
const { body } = require("express-validator");

const { sendChatMessage } = require("../controllers/assistantController");

const protect = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validationMiddleware");

const router = express.Router();

router.post(
  "/chat",
  protect,
  body("message")
    .trim()
    .notEmpty()
    .withMessage("Tell me something about your food preferences first."),
  validateRequest,
  sendChatMessage
);

module.exports = router;