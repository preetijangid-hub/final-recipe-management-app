const mongoose = require("mongoose");

// The two actions that can produce a notification.
const NOTIFICATION_TYPES = ["review", "save"];

const notificationSchema = new mongoose.Schema(
  {
    // The recipe owner who receives the notification.
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The user who reviewed or saved the recipe.
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      required: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// The bell always lists one user's notifications newest first.
notificationSchema.index({ recipient: 1, createdAt: -1 });

// The unread badge counts the same user's unread notifications.
notificationSchema.index({ recipient: 1, read: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
