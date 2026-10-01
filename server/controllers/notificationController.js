const Notification = require("../models/Notification");
const { serializeNotification } = require("../utils/notificationService");

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 50;

// Reads only the fields the bell shows, so nothing private leaves the API.
const withDisplayFields = (query) =>
  query.populate([
    { path: "actor", select: "name" },
    { path: "recipe", select: "title" },
  ]);

const countUnread = (userId) =>
  Notification.countDocuments({ recipient: userId, read: false });

// GET /api/notifications
const getNotifications = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);

    const limit = Math.min(
      Math.max(Number(req.query.limit) || DEFAULT_PAGE_LIMIT, 1),
      MAX_PAGE_LIMIT
    );

    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      withDisplayFields(
        Notification.find({ recipient: req.user._id })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
      ).lean(),

      Notification.countDocuments({ recipient: req.user._id }),

      countUnread(req.user._id),
    ]);

    return res.status(200).json({
      notifications: notifications.map((notification) =>
        serializeNotification(notification)
      ),
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/notifications/unread-count
const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await countUnread(req.user._id);

    return res.status(200).json({ unreadCount });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/:id/read
const markNotificationAsRead = async (req, res, next) => {
  try {
    // The recipient filter makes another user's notification impossible to
    // read or update, even with a valid id.
    const notification = await withDisplayFields(
      Notification.findOneAndUpdate(
        { _id: req.params.id, recipient: req.user._id },
        { $set: { read: true } },
        { new: true }
      )
    ).lean();

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found.",
      });
    }

    return res.status(200).json({
      message: "Notification marked as read.",
      notification: serializeNotification(notification),
      unreadCount: await countUnread(req.user._id),
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/notifications/read-all
const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { $set: { read: true } }
    );

    return res.status(200).json({
      message: "All notifications marked as read.",
      modifiedCount: result.modifiedCount ?? 0,
      unreadCount: 0,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
