const http = require("http");
const request = require("supertest");
const { io: createSocketClient } = require("socket.io-client");

const app = require("../server");
const Notification = require("../models/Notification");
const Recipe = require("../models/Recipe");
const { initSocket } = require("../socket/socketServer");
const {
  NEW_NOTIFICATION_EVENT,
} = require("../utils/notificationService");

const password = "Test@12345";
const stamp = Date.now();

const registerUser = async (name, email) => {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ name, email, password });

  expect(response.statusCode).toBe(201);

  return {
    token: response.body.token,
    id: response.body.user.id,
  };
};

const createRecipe = async (token, title) => {
  const response = await request(app)
    .post("/api/recipes")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title,
      ingredients: ["Ingredient 1"],
      steps: ["Step 1"],
      category: "Italian",
      mealCategory: "Dinner",
    });

  expect(response.statusCode).toBe(201);

  return response.body.recipe._id;
};

// Waits for a socket event to travel over the network.
const waitFor = async (predicate, timeout = 3000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error("Timed out waiting for condition.");
};

describe("Notifications", () => {
  let socketServer;
  let httpServer;
  let baseUrl;

  let owner; // recipe owner used by the review tests
  let actor; // user who reviews or saves
  let restOwner; // dedicated recipient for the REST tests
  let outsider;

  let ownerRecipeId;
  let selfRecipeId;
  let restRecipeId;

  const connectClient = (auth) =>
    new Promise((resolve, reject) => {
      const client = createSocketClient(baseUrl, {
        auth,
        transports: ["websocket"],
        reconnection: false,
      });

      client.on("connect", () => resolve(client));

      client.on("connect_error", (error) => {
        client.close();
        reject(error);
      });
    });

  beforeAll(async () => {
    // A real HTTP server carries both the REST app and Socket.IO, so the
    // socket tests exercise the same wiring production uses.
    httpServer = http.createServer(app);
    socketServer = initSocket(httpServer, { corsOrigin: "*" });

    await new Promise((resolve) => httpServer.listen(0, resolve));

    baseUrl = `http://localhost:${httpServer.address().port}`;

    owner = await registerUser(
      "Notify Owner",
      `notify-owner${stamp}@example.com`
    );
    actor = await registerUser(
      "Notify Actor",
      `notify-actor${stamp}@example.com`
    );
    restOwner = await registerUser(
      "Rest Owner",
      `notify-rest${stamp}@example.com`
    );
    outsider = await registerUser(
      "Notify Outsider",
      `notify-outsider${stamp}@example.com`
    );

    ownerRecipeId = await createRecipe(owner.token, "Owner Lasagna");
    selfRecipeId = await createRecipe(owner.token, "Owner Risotto");
    restRecipeId = await createRecipe(restOwner.token, "Rest Pasta");
  });

  afterAll(async () => {
    await new Promise((resolve) => socketServer.close(resolve));
    await new Promise((resolve) => httpServer.close(resolve));
  });

  describe("Socket authentication", () => {
    test("authenticates a socket connection with a valid JWT", async () => {
      const client = await connectClient({ token: owner.token });

      expect(client.connected).toBe(true);

      client.close();
    });

    test("rejects a socket connection without a token", async () => {
      await expect(connectClient({})).rejects.toBeTruthy();
    });

    test("rejects a socket connection with an invalid token", async () => {
      await expect(
        connectClient({ token: "not-a-real-token" })
      ).rejects.toBeTruthy();
    });

    test("delivers a notification only to the recipient's private room", async () => {
      const ownerClient = await connectClient({ token: owner.token });
      const actorClient = await connectClient({ token: actor.token });

      const ownerEvents = [];
      const actorEvents = [];

      ownerClient.on(NEW_NOTIFICATION_EVENT, (payload) =>
        ownerEvents.push(payload)
      );
      actorClient.on(NEW_NOTIFICATION_EVENT, (payload) =>
        actorEvents.push(payload)
      );

      const response = await request(app)
        .post(`/api/recipes/${ownerRecipeId}/reviews`)
        .set("Authorization", `Bearer ${actor.token}`)
        .send({
          rating: 5,
          comment: "A lovely dinner.",
          sentiment: "Positive",
        });

      expect(response.statusCode).toBe(201);

      await waitFor(() => ownerEvents.length === 1);

      expect(ownerEvents[0].type).toBe("review");
      expect(ownerEvents[0].recipe._id).toBe(ownerRecipeId);
      expect(ownerEvents[0].message).toContain("reviewed");

      // The actor is not the recipient, so nothing is pushed to them.
      expect(actorEvents).toHaveLength(0);

      ownerClient.close();
      actorClient.close();
    });
  });

  describe("Notification creation", () => {
    test("creates a notification for the owner when someone reviews", async () => {
      const reviewRecipeId = await createRecipe(
        owner.token,
        "Reviewed Curry"
      );

      const response = await request(app)
        .post(`/api/recipes/${reviewRecipeId}/reviews`)
        .set("Authorization", `Bearer ${actor.token}`)
        .send({
          rating: 4,
          comment: "Tasty and quick.",
          sentiment: "Positive",
        });

      expect(response.statusCode).toBe(201);

      const notifications = await Notification.find({
        recipient: owner.id,
        recipe: reviewRecipeId,
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("review");
      expect(String(notifications[0].actor)).toBe(actor.id);
      expect(notifications[0].read).toBe(false);
    });

    test("creates one notification when a recipe is saved as a favourite", async () => {
      const saveRecipeId = await createRecipe(owner.token, "Saved Soup");

      const response = await request(app)
        .post(`/api/favourites/${saveRecipeId}`)
        .set("Authorization", `Bearer ${actor.token}`)
        .send({});

      expect(response.statusCode).toBe(201);

      const notifications = await Notification.find({
        recipient: owner.id,
        recipe: saveRecipeId,
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe("save");
    });

    test("does not notify the owner when they review their own recipe", async () => {
      const response = await request(app)
        .post(`/api/recipes/${selfRecipeId}/reviews`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({
          rating: 5,
          comment: "My own favourite dish.",
          sentiment: "Positive",
        });

      expect(response.statusCode).toBe(201);

      const notifications = await Notification.find({
        recipient: owner.id,
        recipe: selfRecipeId,
      });

      expect(notifications).toHaveLength(0);
    });

    test("does not notify the owner when they save their own recipe", async () => {
      const selfSaveRecipeId = await createRecipe(
        owner.token,
        "Self Saved Toast"
      );

      const response = await request(app)
        .post(`/api/favourites/${selfSaveRecipeId}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({});

      expect(response.statusCode).toBe(201);

      const notifications = await Notification.find({
        recipient: owner.id,
        recipe: selfSaveRecipeId,
      });

      expect(notifications).toHaveLength(0);
    });
  });

  describe("Notification REST API", () => {
    let readNotificationId;

    beforeAll(async () => {
      // Two unread notifications for the dedicated REST owner and one that
      // belongs to somebody else.
      const first = await Notification.create({
        recipient: restOwner.id,
        actor: actor.id,
        recipe: restRecipeId,
        type: "review",
      });

      await Notification.create({
        recipient: restOwner.id,
        actor: outsider.id,
        recipe: restRecipeId,
        type: "save",
      });

      await Notification.create({
        recipient: outsider.id,
        actor: actor.id,
        recipe: restRecipeId,
        type: "review",
      });

      readNotificationId = first._id;
    });

    test("requires authentication for every endpoint", async () => {
      const listResponse = await request(app).get("/api/notifications");
      expect(listResponse.statusCode).toBe(401);

      const countResponse = await request(app).get(
        "/api/notifications/unread-count"
      );
      expect(countResponse.statusCode).toBe(401);

      const readResponse = await request(app).patch(
        `/api/notifications/${readNotificationId}/read`
      );
      expect(readResponse.statusCode).toBe(401);

      const readAllResponse = await request(app).patch(
        "/api/notifications/read-all"
      );
      expect(readAllResponse.statusCode).toBe(401);
    });

    test("returns the signed-in user's notifications with an unread count", async () => {
      const response = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${restOwner.token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.notifications).toHaveLength(2);
      expect(response.body.unreadCount).toBe(2);
      expect(response.body.pagination.total).toBe(2);

      // The bell shows the actor name and recipe title, nothing else.
      const first = response.body.notifications[0];
      expect(first.actor).toHaveProperty("name");
      expect(first.recipe._id).toBe(restRecipeId);
      expect(first).toHaveProperty("message");
    });

    test("reports the unread count on its own endpoint", async () => {
      const response = await request(app)
        .get("/api/notifications/unread-count")
        .set("Authorization", `Bearer ${restOwner.token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.unreadCount).toBe(2);
    });

    test("marks a single notification as read and updates the count", async () => {
      const response = await request(app)
        .patch(`/api/notifications/${readNotificationId}/read`)
        .set("Authorization", `Bearer ${restOwner.token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.notification.read).toBe(true);
      expect(response.body.unreadCount).toBe(1);
    });

    test("marks all notifications as read", async () => {
      const response = await request(app)
        .patch("/api/notifications/read-all")
        .set("Authorization", `Bearer ${restOwner.token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.unreadCount).toBe(0);
      expect(response.body.modifiedCount).toBe(1);

      const listResponse = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${restOwner.token}`);

      expect(
        listResponse.body.notifications.every((item) => item.read)
      ).toBe(true);
      expect(listResponse.body.unreadCount).toBe(0);
    });

    test("does not let a user read another user's notification", async () => {
      const foreignNotification = await Notification.findOne({
        recipient: outsider.id,
      });

      const response = await request(app)
        .patch(`/api/notifications/${foreignNotification._id}/read`)
        .set("Authorization", `Bearer ${restOwner.token}`);

      expect(response.statusCode).toBe(404);

      // The notification is untouched for its real owner.
      const reloaded = await Notification.findById(foreignNotification._id);
      expect(reloaded.read).toBe(false);
    });

    test("validates the notification id", async () => {
      const response = await request(app)
        .patch("/api/notifications/not-a-valid-id/read")
        .set("Authorization", `Bearer ${restOwner.token}`);

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty("errors");
    });

    test("returns 404 for a notification that does not exist", async () => {
      const missingId = new Notification({})._id.toString();

      const response = await request(app)
        .patch(`/api/notifications/${missingId}/read`)
        .set("Authorization", `Bearer ${restOwner.token}`);

      expect(response.statusCode).toBe(404);
    });

    test("keeps the recipe usable after notifications were created", async () => {
      const recipe = await Recipe.findById(restRecipeId);

      expect(recipe).toBeTruthy();
      expect(recipe.title).toBe("Rest Pasta");
    });
  });
});

