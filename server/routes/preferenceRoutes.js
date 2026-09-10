const express = require("express");

const { getPreferences, updatePreferences } = require("../controllers/preferenceController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

router
  .route("/")
  .get(protect, getPreferences)
  .put(protect, updatePreferences);

module.exports = router;