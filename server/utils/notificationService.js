const Notification = require("../models/Notification");
const { getIO, userRoom } = require("../socket/socketServer");

// Event name the Angular client listens for.
const NEW_NOTIFICATION_EVENT = "notification:new";

const buildMessage = (type, actorName, recipeTitle) => {
  if (type === "review") {
    return `${actorName} reviewed "${recipeTitle}"`;
  }

  return `${actorName} saved "${recipeTitle}"`;
};

// Shapes a stored notification into the payload the client renders. It
// accepts both a populated document and a plain object so the REST
// controller and the socket emitter return exactly the same structure.
const serializeNotification = (notification) => {
  const actor = notification.actor;
  const recipe = notification.recipe;

  const actorId = actor?._id ?? actor;
  const actorName = actor?.name ?? "Someone";
  const recipeId = recipe?._id ?? recipe;
  const recipeTitle = recipe?.title ?? "your recipe";

  return {
    _id: String(notification._id),
    type: notification.type,
    read: Boolean(notification.read),
    message: buildMessage(notification.type, actorName, recipeTitle),
    createdAt: notification.createdAt,
    actor: {
      _id: String(actorId),
      name: actorName,
    },
    recipe: {
      _id: String(recipeId),
      title: recipeTitle,
    },
  };
};

/**
 * Saves a notification and then pushes it to the owner's private room.
 *
 * The document is written first, so the notification is still there when
 * the owner is offline and simply loads it later over the REST API. Users
 * are never notified about their own reviews or saves.
 */
const notifyRecipeOwner = async ({ recipient, actor, recipe, type }) => {
  if (String(recipient) === String(actor)) {
    return null;
  }

  const notification = await Notification.create({
    recipient,
    actor,
    recipe,
    type,
  });

  await notification.populate([
    { path: "actor", select: "name" },
    { path: "recipe", select: "title" },
  ]);

  const payload = serializeNotification(notification);

  const io = getIO();

  if (io) {
    io.to(userRoom(recipient)).emit(NEW_NOTIFICATION_EVENT, payload);
  }

  return payload;
};

module.exports = {
  NEW_NOTIFICATION_EVENT,
  serializeNotification,
  notifyRecipeOwner,
};
