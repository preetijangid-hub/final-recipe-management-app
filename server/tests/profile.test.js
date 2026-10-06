const request = require("supertest");

const app = require("../server");
const User = require("../models/User");

describe("Creator Profiles API", () => {
  let userAToken;
  let userBToken;
  let userAId;
  let userBId;

  const password = "Test@12345";

  const userAEmail = `profile-a${Date.now()}@example.com`;
  const userBEmail = `profile-b${Date.now()}@example.com`;

  beforeAll(async () => {
    const userAResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Profile Alpha",
        email: userAEmail,
        password,
      });

    expect(userAResponse.statusCode).toBe(201);
    userAToken = userAResponse.body.token;
    userAId = userAResponse.body.user.id;

    const userBResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Profile Beta",
        email: userBEmail,
        password,
      });

    expect(userBResponse.statusCode).toBe(201);
    userBToken = userBResponse.body.token;
    userBId = userBResponse.body.user.id;
  });

  test("should require authentication for the my-profile endpoints", async () => {
    const getResponse = await request(app).get("/api/profiles/me");

    expect(getResponse.statusCode).toBe(401);

    const patchResponse = await request(app)
      .patch("/api/profiles/me")
      .send({ profession: "Chef" });

    expect(patchResponse.statusCode).toBe(401);

    const putResponse = await request(app)
      .put("/api/profiles/me")
      .send({ profession: "Chef" });

    expect(putResponse.statusCode).toBe(401);
  });

  test("should return the authenticated user's own profile", async () => {
    const response = await request(app)
      .get("/api/profiles/me")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.profile._id).toBe(userAId);
    expect(response.body.profile.name).toBe("Profile Alpha");
    expect(response.body.profile.email).toBe(userAEmail);
    // New accounts start without creator profile details.
    expect(response.body.profile.profession).toBe("");
    expect(response.body.profile.profilePhoto).toBe("");
    expect(response.body.profile.password).toBeUndefined();
  });

  test("should update profession through PATCH on my profile", async () => {
    const response = await request(app)
      .patch("/api/profiles/me")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ profession: "  Chef  " });

    expect(response.statusCode).toBe(200);
    // Surrounding whitespace is trimmed before it is stored.
    expect(response.body.profile.profession).toBe("Chef");

    const followUp = await request(app)
      .get("/api/profiles/me")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(followUp.statusCode).toBe(200);
    expect(followUp.body.profile.profession).toBe("Chef");
    // An update never changes the account identity.
    expect(followUp.body.profile.email).toBe(userAEmail);
  });

  test("should update profilePhoto through PATCH and PUT on my profile", async () => {
    const patchResponse = await request(app)
      .patch("/api/profiles/me")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ profilePhoto: "https://example.com/avatar-a.jpg" });

    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.body.profile.profilePhoto).toBe(
      "https://example.com/avatar-a.jpg"
    );

    const putResponse = await request(app)
      .put("/api/profiles/me")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ profilePhoto: "https://example.com/avatar-b.jpg" });

    expect(putResponse.statusCode).toBe(200);
    expect(putResponse.body.profile.profilePhoto).toBe(
      "https://example.com/avatar-b.jpg"
    );

    // Other profile fields stay untouched by a photo-only update.
    expect(putResponse.body.profile.profession).toBe("Chef");
  });

  test("should return only safe public information for a public profile", async () => {
    const response = await request(app).get(`/api/profiles/${userAId}`);

    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.body.profile).sort()).toEqual([
      "_id",
      "name",
      "profession",
      "profilePhoto",
    ]);
    expect(response.body.profile._id).toBe(userAId);
    expect(response.body.profile.name).toBe("Profile Alpha");
    expect(response.body.profile.profession).toBe("Chef");
    expect(response.body.profile.profilePhoto).toBe(
      "https://example.com/avatar-b.jpg"
    );
  });

  test("should never expose the password or authentication secrets publicly", async () => {
    // The password really is stored for this account, it is simply hidden.
    const storedUser = await User.findById(userAId);

    expect(storedUser).not.toBeNull();
    expect(storedUser.password).toBeTruthy();

    const response = await request(app).get(`/api/profiles/${userAId}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.profile.password).toBeUndefined();
    expect(response.body.profile.role).toBeUndefined();
    expect(response.body.profile.preferences).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain(storedUser.password);
    expect(JSON.stringify(response.body)).not.toContain(userAEmail);
  });

  test("should not let user A update user B through the my-profile endpoint", async () => {
    const response = await request(app)
      .patch("/api/profiles/me")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        // A malicious body tries to impersonate user B.
        _id: userBId,
        id: userBId,
        email: userBEmail,
        profession: "Impostor",
      });

    expect(response.statusCode).toBe(200);
    // Only user A's own account changed; identity fields are ignored.
    expect(response.body.profile._id).toBe(userAId);
    expect(response.body.profile.email).toBe(userAEmail);
    expect(response.body.profile.profession).toBe("Impostor");

    const userBProfile = await request(app).get(
      `/api/profiles/${userBId}`
    );

    expect(userBProfile.statusCode).toBe(200);
    expect(userBProfile.body.profile.profession).toBe("");
    expect(userBProfile.body.profile.name).toBe("Profile Beta");

    // User B's own view of their profile is also unchanged.
    const userBMe = await request(app)
      .get("/api/profiles/me")
      .set("Authorization", `Bearer ${userBToken}`);

    expect(userBMe.statusCode).toBe(200);
    expect(userBMe.body.profile.profession).toBe("");

    // There is no write route for another user's profile either.
    const directUpdate = await request(app)
      .put(`/api/profiles/${userBId}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ profession: "Hijacked" });

    expect(directUpdate.statusCode).toBe(404);
  });

  test("should return 404 for a nonexistent public profile", async () => {
    const missingId = new User({})._id.toString();

    const response = await request(app).get(`/api/profiles/${missingId}`);

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toMatch(/not found/i);
  });

  test("should reject an invalid public profile id", async () => {
    const response = await request(app).get(
      "/api/profiles/not-a-valid-id"
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("errors");
  });

  test("should reject an overly long or invalid profession", async () => {
    const longProfession = "a".repeat(101);

    const tooLongResponse = await request(app)
      .patch("/api/profiles/me")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ profession: longProfession });

    expect(tooLongResponse.statusCode).toBe(400);
    expect(tooLongResponse.body).toHaveProperty("errors");

    const notStringResponse = await request(app)
      .patch("/api/profiles/me")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ profession: 12345 });

    expect(notStringResponse.statusCode).toBe(400);
    expect(notStringResponse.body).toHaveProperty("errors");

    // Rejected updates leave the stored profile untouched.
    const storedUser = await User.findById(userAId);

    expect(storedUser.profession).toBe("Impostor");
  });

  test("should reject an invalid profile photo URL", async () => {
    const response = await request(app)
      .patch("/api/profiles/me")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ profilePhoto: "not-a-url" });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("errors");
  });

  test("should allow clearing profession and profile photo with empty values", async () => {
    const response = await request(app)
      .patch("/api/profiles/me")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ profession: "", profilePhoto: "" });

    expect(response.statusCode).toBe(200);
    expect(response.body.profile.profession).toBe("");
    expect(response.body.profile.profilePhoto).toBe("");

    const publicResponse = await request(app).get(
      `/api/profiles/${userAId}`
    );

    expect(publicResponse.statusCode).toBe(200);
    expect(publicResponse.body.profile.profession).toBe("");
    expect(publicResponse.body.profile.profilePhoto).toBe("");
  });
});

describe("Public creator recipes API", () => {
  let userAToken;
  let userBToken;
  let userAId;

  const password = "Test@12345";

  const userARecipeTitle = "Creator Alpha Pasta";
  const userBRecipeTitle = "Creator Beta Salad";

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

  beforeAll(async () => {
    const userAResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Creator Alpha",
        email: `creator-a${Date.now()}@example.com`,
        password,
      });

    expect(userAResponse.statusCode).toBe(201);
    userAToken = userAResponse.body.token;
    userAId = userAResponse.body.user.id;

    const userBResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Creator Beta",
        email: `creator-b${Date.now()}@example.com`,
        password,
      });

    expect(userBResponse.statusCode).toBe(201);
    userBToken = userBResponse.body.token;

    await createRecipe(userAToken, userARecipeTitle);
    await createRecipe(userBToken, userBRecipeTitle);
  });

  test("returns only that creator's recipes without authentication", async () => {
    const response = await request(app).get(
      `/api/profiles/${userAId}/recipes`
    );

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.recipes)).toBe(true);

    const titles = response.body.recipes.map((recipe) => recipe.title);

    expect(titles).toContain(userARecipeTitle);
    expect(titles).not.toContain(userBRecipeTitle);
  });

  test("keeps creator recipe cards limited to safe public fields", async () => {
    const response = await request(app).get(
      `/api/profiles/${userAId}/recipes`
    );

    expect(response.statusCode).toBe(200);

    const card = response.body.recipes.find(
      (recipe) => recipe.title === userARecipeTitle
    );

    expect(card).toBeDefined();
    expect(card.user._id).toBe(userAId);
    expect(card.user.name).toBe("Creator Alpha");
    expect(card.user.email).toBeUndefined();
    expect(card.user.role).toBeUndefined();
    expect(card.user.password).toBeUndefined();
  });

  test("returns an empty recipe list for a creator with no recipes", async () => {
    const emptyResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Quiet Creator",
        email: `quiet-creator${Date.now()}@example.com`,
        password,
      });

    expect(emptyResponse.statusCode).toBe(201);

    const response = await request(app).get(
      `/api/profiles/${emptyResponse.body.user.id}/recipes`
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.recipes).toEqual([]);
  });

  test("returns 404 for a nonexistent creator's recipes", async () => {
    const missingId = new User({})._id.toString();

    const response = await request(app).get(
      `/api/profiles/${missingId}/recipes`
    );

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toMatch(/not found/i);
  });

  test("rejects an invalid creator id for the recipes endpoint", async () => {
    const response = await request(app).get(
      "/api/profiles/not-a-valid-id/recipes"
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("errors");
  });
});
