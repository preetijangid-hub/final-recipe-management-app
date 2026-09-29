const request = require("supertest");

const app = require("../server");
const Recipe = require("../models/Recipe");
const User = require("../models/User");

describe("Favourites API", () => {
  let ownerToken;
  let otherUserToken;
  let recipeId;
  let secondRecipeId;

  const password = "Test@12345";

  const ownerEmail = `fav-owner${Date.now()}@example.com`;
  const otherEmail = `fav-other${Date.now()}@example.com`;

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
    const ownerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Favourite Owner",
        email: ownerEmail,
        password,
      });

    expect(ownerResponse.statusCode).toBe(201);
    ownerToken = ownerResponse.body.token;

    const otherResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Favourite Other",
        email: otherEmail,
        password,
      });

    expect(otherResponse.statusCode).toBe(201);
    otherUserToken = otherResponse.body.token;

    recipeId = await createRecipe(
      ownerToken,
      "Favourite Pasta"
    );

    secondRecipeId = await createRecipe(
      ownerToken,
      "Favourite Salad"
    );
  });

  test("should reject favourites access without authentication", async () => {
    const listResponse = await request(app).get("/api/favourites");

    expect(listResponse.statusCode).toBe(401);

    const addResponse = await request(app)
      .post(`/api/favourites/${recipeId}`)
      .send({});

    expect(addResponse.statusCode).toBe(401);

    const removeResponse = await request(app)
      .delete(`/api/favourites/${recipeId}`);

    expect(removeResponse.statusCode).toBe(401);
  });

  test("should add a recipe to favourites", async () => {
    const response = await request(app)
      .post(`/api/favourites/${recipeId}`)
      .set("Authorization", `Bearer ${otherUserToken}`)
      .send({});

    expect(response.statusCode).toBe(201);
    expect(response.body.message).toContain("added to favourites");
  });

  test("should reject favouriting the same recipe twice", async () => {
    const response = await request(app)
      .post(`/api/favourites/${recipeId}`)
      .set("Authorization", `Bearer ${otherUserToken}`)
      .send({});

    expect(response.statusCode).toBe(409);
  });

  test("should list only the current user's favourites with recipe details", async () => {
    const response = await request(app)
      .get("/api/favourites")
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.favourites).toHaveLength(1);
    expect(response.body.favourites[0]._id).toBe(recipeId);
    expect(response.body.favourites[0].title).toBe("Favourite Pasta");

    // Every entry is a plain recipe, which is the shape the client reads.
    expect(response.body.favourites[0].recipe).toBeUndefined();

    // Another user has no favourites of their own.
    const emptyResponse = await request(app)
      .get("/api/favourites")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(emptyResponse.statusCode).toBe(200);
    expect(emptyResponse.body.favourites).toHaveLength(0);
  });

  test("should remove a recipe from favourites", async () => {
    const response = await request(app)
      .delete(`/api/favourites/${recipeId}`)
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toContain("removed from favourites");

    // A second removal has nothing left to delete.
    const repeatResponse = await request(app)
      .delete(`/api/favourites/${recipeId}`)
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(repeatResponse.statusCode).toBe(404);

    const listResponse = await request(app)
      .get("/api/favourites")
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(listResponse.body.favourites).toHaveLength(0);
  });

  test("should return 404 when favouriting a missing recipe", async () => {
    const missingId = new Recipe({})._id.toString();

    const response = await request(app)
      .post(`/api/favourites/${missingId}`)
      .set("Authorization", `Bearer ${otherUserToken}`)
      .send({});

    expect(response.statusCode).toBe(404);
  });

  test("should reject an invalid recipe id", async () => {
    const response = await request(app)
      .post("/api/favourites/not-a-valid-id")
      .set("Authorization", `Bearer ${otherUserToken}`)
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("errors");
  });

  test("should keep a favourited recipe usable by both users independently", async () => {
    // Both users favourite different recipes; each list stays separate.
    await request(app)
      .post(`/api/favourites/${secondRecipeId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});

    const ownerList = await request(app)
      .get("/api/favourites")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(ownerList.body.favourites).toHaveLength(1);
    expect(ownerList.body.favourites[0]._id).toBe(secondRecipeId);

    const otherList = await request(app)
      .get("/api/favourites")
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(otherList.body.favourites).toHaveLength(0);
  });
});
