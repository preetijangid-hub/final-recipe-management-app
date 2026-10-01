const express = require("express");
const { param } = require("express-validator");

const {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require("../controllers/notificationController");

const protect = require("../middleware/authMiddleware");
const validateRequest = require("../middleware/validationMiddleware");

const router = express.Router();

const notificationIdValidation = [
  param("id")
    .isMongoId()
    .withMessage("Invalid notification ID."),
];

// Every notification route belongs to the signed-in user.
router.use(protect);

router.get("/", getNotifications);

router.get("/unread-count", getUnreadCount);

router.patch("/read-all", markAllNotificationsAsRead);

router.patch(
  "/:id/read",
  notificationIdValidation,
  validateRequest,
  markNotificationAsRead
);

module.exports = router;
