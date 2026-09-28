const request = require("supertest");

const app = require("../server");
const Recipe = require("../models/Recipe");
const Review = require("../models/Review");
const User = require("../models/User");

describe("Review API", () => {
  let ownerToken;
  let authorToken;
  let otherToken;
  let adminToken;
  let ownerUserId;
  let recipeId;
  let emptyRecipeId;

  const password = "Test@12345";

  const ownerEmail = `owner${Date.now()}@example.com`;
  const authorEmail = `author${Date.now()}@example.com`;
  const otherEmail = `other${Date.now()}@example.com`;
  const adminEmail = `admin${Date.now()}@example.com`;

  const registerUser = async (name, email) => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ name, email, password });

    expect(response.statusCode).toBe(201);

    return response.body;
  };

  beforeAll(async () => {
    const owner = await registerUser("Recipe Owner", ownerEmail);
    ownerToken = owner.token;
    ownerUserId = owner.user.id;

    const author = await registerUser("Review Author", authorEmail);
    authorToken = author.token;

    const other = await registerUser("Other User", otherEmail);
    otherToken = other.token;

    const admin = await registerUser("Admin User", adminEmail);

    await User.findByIdAndUpdate(admin.user.id, { role: "admin" });

    const adminLoginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: adminEmail, password });

    expect(adminLoginResponse.statusCode).toBe(200);

    adminToken = adminLoginResponse.body.token;

    const recipeResponse = await request(app)
      .post("/api/recipes")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        title: "Review Test Recipe",
        ingredients: ["Ingredient 1"],
        steps: ["Step 1"],
        category: "Indian",
        mealCategory: "Dinner",
      });

    expect(recipeResponse.statusCode).toBe(201);

    recipeId = recipeResponse.body.recipe._id;

    const emptyRecipeResponse = await request(app)
      .post("/api/recipes")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        title: "Unreviewed Recipe",
        ingredients: ["Ingredient 1"],
        steps: ["Step 1"],
        category: "Italian",
        mealCategory: "Lunch",
      });

    expect(emptyRecipeResponse.statusCode).toBe(201);

    emptyRecipeId = emptyRecipeResponse.body.recipe._id;
  });

  test("should reject review creation without authentication", async () => {
    const response = await request(app)
      .post(`/api/recipes/${recipeId}/reviews`)
      .send({
        rating: 5,
        comment: "Delicious recipe, will make it again.",
      });

    expect(response.statusCode).toBe(401);
  });

  test("should reject an invalid rating", async () => {
    const response = await request(app)
      .post(`/api/recipes/${recipeId}/reviews`)
      .set("Authorization", `Bearer ${authorToken}`)
      .send({
        rating: 6,
        comment: "Delicious recipe, will make it again.",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("errors");
  });

  test("should reject a non-integer rating", async () => {
    const response = await request(app)
      .post(`/api/recipes/${recipeId}/reviews`)
      .set("Authorization", `Bearer ${authorToken}`)
      .send({
        rating: 4.5,
        comment: "Delicious recipe, will make it again.",
      });

    expect(response.statusCode).toBe(400);
  });

  test("should reject an empty review comment", async () => {
    const response = await request(app)
      .post(`/api/recipes/${recipeId}/reviews`)
      .set("Authorization", `Bearer ${authorToken}`)
      .send({
        rating: 5,
        comment: "   ",
      });

    expect(response.statusCode).toBe(400);
  });

  test("should return 404 when reviewing a missing recipe", async () => {
    const response = await request(app)
      .post("/api/recipes/600000000000000000000000/reviews")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({
        rating: 5,
        comment: "Delicious recipe, will make it again.",
      });

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("Recipe not found");
  });

  test("should create a review with a valid rating and comment", async () => {
    const response = await request(app)
      .post(`/api/recipes/${recipeId}/reviews`)
      .set("Authorization", `Bearer ${authorToken}`)
      .send({
        rating: 5,
        comment: "Loved it. The spices were perfectly balanced.",
        sentiment: "Positive",
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.review.rating).toBe(5);
    expect(response.body.review.comment).toContain("Loved it");
    expect(response.body.review.sentiment).toBe("Positive");
    expect(response.body.review.user.name).toBe("Review Author");
    expect(response.body.summary).toEqual({ average: 5, count: 1 });
  });

  test("should prevent a duplicate review from the same user", async () => {
    const response = await request(app)
      .post(`/api/recipes/${recipeId}/reviews`)
      .set("Authorization", `Bearer ${authorToken}`)
      .send({
        rating: 4,
        comment: "Trying to review the same recipe twice.",
      });

    expect(response.statusCode).toBe(409);
    expect(response.body.message).toBe(
      "You have already reviewed this recipe."
    );
  });

  test("should list reviews for a recipe with author details", async () => {
    const listResponse = await request(app).get(
      `/api/recipes/${recipeId}/reviews`
    );

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.body.reviews).toHaveLength(1);
    expect(listResponse.body.reviews[0].user.name).toBe("Review Author");
    expect(listResponse.body.reviews[0].user.password).toBeUndefined();

    const secondResponse = await request(app)
      .post(`/api/recipes/${recipeId}/reviews`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({
        rating: 4,
        comment: "Pretty good, will try more spices next time.",
      });

    expect(secondResponse.statusCode).toBe(201);
  });

  test("should aggregate the average rating and review count", async () => {
    const response = await request(app).get(
      `/api/recipes/${recipeId}/reviews/summary`
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.summary).toEqual({ average: 4.5, count: 2 });

    const recipeResponse = await request(app).get(
      `/api/recipes/${recipeId}`
    );

    expect(recipeResponse.statusCode).toBe(200);
    expect(recipeResponse.body.recipe.rating.average).toBe(4.5);
    expect(recipeResponse.body.recipe.rating.count).toBe(2);
  });

  test("should return a zero summary for a recipe without reviews", async () => {
    const summaryResponse = await request(app).get(
      `/api/recipes/${emptyRecipeId}/reviews/summary`
    );

    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.body.summary).toEqual({ average: 0, count: 0 });

    const listResponse = await request(app).get(
      `/api/recipes/${emptyRecipeId}/reviews`
    );

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.body.reviews).toEqual([]);
  });

  test("should reject review deletion without authentication", async () => {
    const listResponse = await request(app).get(
      `/api/recipes/${recipeId}/reviews`
    );

    const reviewId = listResponse.body.reviews[0]._id;

    const response = await request(app).delete(
      `/api/recipes/${recipeId}/reviews/${reviewId}`
    );

    expect(response.statusCode).toBe(401);
  });

  test("should block a regular user from deleting someone else's review", async () => {
    const authorReview = await Review.findOne({
      recipe: recipeId,
    }).sort({ rating: -1 });

    const response = await request(app)
      .delete(`/api/recipes/${recipeId}/reviews/${authorReview._id}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe(
      "You are not allowed to delete this review."
    );
  });

  test("should return 404 when deleting a review that does not exist", async () => {
    const response = await request(app)
      .delete(
        "/api/recipes/600000000000000000000000/reviews/610000000000000000000000"
      )
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(404);
  });

  test("should reject an invalid review ID", async () => {
    const response = await request(app)
      .delete(`/api/recipes/${recipeId}/reviews/not-an-id`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(400);
  });

  test("should let the author delete their own review", async () => {
    const authorReview = await Review.findOne({
      recipe: recipeId,
      rating: 5,
    });

    const response = await request(app)
      .delete(`/api/recipes/${recipeId}/reviews/${authorReview._id}`)
      .set("Authorization", `Bearer ${authorToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.summary).toEqual({ average: 4, count: 1 });
  });

  test("should let the recipe owner delete another user's review", async () => {
    const otherReview = await Review.findOne({ recipe: recipeId });

    const response = await request(app)
      .delete(`/api/recipes/${recipeId}/reviews/${otherReview._id}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.summary).toEqual({ average: 0, count: 0 });
  });

  test("should let an admin delete another user's review", async () => {
    const createResponse = await request(app)
      .post(`/api/recipes/${recipeId}/reviews`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({
        rating: 3,
        comment: "Decent recipe, nothing special though.",
      });

    expect(createResponse.statusCode).toBe(201);

    const response = await request(app)
      .delete(
        `/api/recipes/${recipeId}/reviews/${createResponse.body.review._id}`
      )
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.summary).toEqual({ average: 0, count: 0 });
  });
});