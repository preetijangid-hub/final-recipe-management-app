const request = require("supertest");
const mongoose = require("mongoose");

const app = require("../server");
const Category = require("../models/Category");
const Recipe = require("../models/Recipe");
const User = require("../models/User");

describe("Category Management API", () => {
  const password = "Test@12345";
  const adminEmail = `catadmin${Date.now()}@example.com`;
  const userEmail = `catuser${Date.now()}@example.com`;

  let adminToken;
  let userToken;
  let categoryId;

  beforeAll(async () => {
    const adminRegister = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Category Admin",
        email: adminEmail,
        password,
      });

    expect(adminRegister.statusCode).toBe(201);

    await User.findByIdAndUpdate(adminRegister.body.user.id, {
      role: "admin",
    });

    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: adminEmail,
        password,
      });

    expect(adminLogin.statusCode).toBe(200);

    adminToken = adminLogin.body.token;

    const userRegister = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Category User",
        email: userEmail,
        password,
      });

    expect(userRegister.statusCode).toBe(201);

    userToken = userRegister.body.token;
  });

  test("should create a category as admin", async () => {
    const response = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "  Test Cuisine  ",
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.category.name).toBe("Test Cuisine");
    expect(response.body.category.createdAt).toBeDefined();
    expect(response.body.category.updatedAt).toBeDefined();

    categoryId = response.body.category._id;
  });

  test("should reject duplicate categories case-insensitively", async () => {
    const response = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "test cuisine",
      });

    expect(response.statusCode).toBe(409);
  });

  test("should reject category creation for non-admin users", async () => {
    const response = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        name: "User Category",
      });

    expect(response.statusCode).toBe(403);
  });

  test("should list categories for authenticated users", async () => {
    const response = await request(app)
      .get("/api/categories")
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.categories)).toBe(true);
    expect(
      response.body.categories.some(
        (category) => category._id === categoryId
      )
    ).toBe(true);
  });

  test("should reject invalid category names", async () => {
    const response = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "x",
      });

    expect(response.statusCode).toBe(400);
  });

  test("should rename a category and update recipes using it", async () => {
    const recipe = await Recipe.create({
      title: "Category Rename Recipe",
      ingredients: ["Ingredient"],
      steps: ["Step"],
      category: "test cuisine",
      mealCategory: "Dinner",
      user: new mongoose.Types.ObjectId(),
    });

    const response = await request(app)
      .put(`/api/categories/${categoryId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Fusion Test",
      });

    expect(response.statusCode).toBe(200);

    const updatedRecipe = await Recipe.findById(recipe._id);

    expect(updatedRecipe.category).toBe("Fusion Test");

    await Recipe.findByIdAndDelete(recipe._id);
  });

  test("should block deleting a category used by recipes", async () => {
    const recipe = await Recipe.create({
      title: "Category Delete Guard Recipe",
      ingredients: ["Ingredient"],
      steps: ["Step"],
      category: "Fusion Test",
      mealCategory: "Dinner",
      user: new mongoose.Types.ObjectId(),
    });

    const response = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(409);
    expect(response.body.message).toMatch(/recipe/i);

    await Recipe.findByIdAndDelete(recipe._id);
  });

  test("should delete an unused category", async () => {
    const response = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
  });

  afterAll(async () => {
    await Category.deleteMany({
      name: {
        $in: ["Test Cuisine", "Fusion Test"],
      },
    });

    await User.deleteMany({
      email: {
        $in: [adminEmail, userEmail],
      },
    });
  });
});