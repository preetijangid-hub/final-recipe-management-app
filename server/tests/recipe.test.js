const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const Recipe = require("../models/Recipe");
const User = require("../models/User");

describe("Recipe Authorization API", () => { 
  let ownerToken;
  let ownerUserId;
  let otherUserToken;
  let adminToken;
  let recipeId;  

  const password = "Test@12345";  

  const ownerEmail = `owner${Date.now()}@example.com`;
  const otherEmail = `other${Date.now()}@example.com`;
  const adminEmail = `admin${Date.now()}@example.com`;

  beforeAll(async () => {
    // Create recipe owner
    const ownerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Recipe Owner",
        email: ownerEmail,
        password,
      });

    expect(ownerResponse.statusCode).toBe(201);

    ownerToken = ownerResponse.body.token;
    ownerUserId = ownerResponse.body.user.id;

    // Create another user
    const otherResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Other User",
        email: otherEmail,
        password,
      });

    expect(otherResponse.statusCode).toBe(201);

    otherUserToken = otherResponse.body.token;

    // Create admin user
    const adminResponse = await request(app)
      .post("/api/auth/register")
      .send({   
        name: "Admin User",
        email: adminEmail,
        password,
      });

    expect(adminResponse.statusCode).toBe(201);

    const adminUserId = adminResponse.body.user.id;

    await User.findByIdAndUpdate(adminUserId, {
      role: "admin",
    });

    // Login again so token contains authenticated admin user
    const adminLoginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: adminEmail,
        password,
      });

    expect(adminLoginResponse.statusCode).toBe(200);

    adminToken = adminLoginResponse.body.token;

    // Create recipe owned by owner
    const recipeResponse = await request(app)
      .post("/api/recipes")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        title: "Test Recipe",
        ingredients: ["Ingredient 1", "Ingredient 2"],
        steps: ["Step 1", "Step 2"],
        category: "Dinner",
      });

    expect(recipeResponse.statusCode).toBe(201);

    recipeId = recipeResponse.body.recipe._id;
  });

  test("GET /api/recipes should not fail when a recipe document has no ratings field", async () => {
    await Recipe.create({
      title: "Ratings-free Recipe",
      ingredients: ["Ingredient A"],
      steps: ["Step A"],
      category: "Dinner",
      user: ownerUserId,
    });

    const response = await request(app)
      .get("/api/recipes?page=1&limit=5")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.recipes).toEqual(expect.any(Array));
  });

  test("owner should be able to update their own recipe", async () => {
    const response = await request(app)
      .put(`/api/recipes/${recipeId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        title: "Updated Recipe",
        ingredients: ["Updated Ingredient"],
        steps: ["Updated Step"],
        category: "Lunch", 
      });

    expect(response.statusCode).toBe(200);
  });

  test("non-owner should not be able to update another user's recipe", async () => {
    const response = await request(app)
      .put(`/api/recipes/${recipeId}`)
      .set("Authorization", `Bearer ${otherUserToken}`)     
      .send({
        title: "Unauthorized Update",
        ingredients: ["Ingredient"],
        steps: ["Step"],
        category: "Lunch",
      });

    expect(response.statusCode).toBe(403);
  });

  test("admin should be able to update another user's recipe", async () => {
    const response = await request(app)
      .put(`/api/recipes/${recipeId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Admin Updated Recipe",
        ingredients: ["Admin Ingredient"],
        steps: ["Admin Step"],
        category: "Dinner",
      });

    expect(response.statusCode).toBe(200);
  });

  test("non-owner should not be able to delete another user's recipe", async () => {
    const response = await request(app)
      .delete(`/api/recipes/${recipeId}`)
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(response.statusCode).toBe(403);
  });

  test("admin should be able to delete another user's recipe", async () => {
    const response = await request(app)
      .delete(`/api/recipes/${recipeId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
  });

  afterAll(async () => {
    await Recipe.deleteMany({
      _id: recipeId,
    });

    await User.deleteMany({
      email: {
        $in: [ownerEmail, otherEmail, adminEmail],
      },
    });

    await mongoose.connection.close();
  });
});