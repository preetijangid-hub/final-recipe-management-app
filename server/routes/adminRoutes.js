const express = require("express");

const { getAdminStats } = require("../controllers/adminController");

const protect = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");

const router = express.Router();

router.get("/stats", protect, requireAdmin, getAdminStats);

module.exports = router;