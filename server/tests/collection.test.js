const request = require("supertest");

const app = require("../server");
const Collection = require("../models/Collection");

describe("Collections API", () => {
  let ownerToken;
  let otherUserToken;
  let recipeId;
  let secondRecipeId;
  let collectionId;

  const password = "Test@12345";

  const ownerEmail = `col-owner${Date.now()}@example.com`;
  const otherEmail = `col-other${Date.now()}@example.com`;

  const createRecipe = async (token, title, image = "") => {
    const response = await request(app)
      .post("/api/recipes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title,
        ingredients: ["Ingredient 1"],
        steps: ["Step 1"],
        category: "Italian",
        mealCategory: "Dinner",
        image,
      });

    expect(response.statusCode).toBe(201);

    return response.body.recipe._id;
  };

  beforeAll(async () => {
    const ownerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Collection Owner",
        email: ownerEmail,
        password,
      });

    expect(ownerResponse.statusCode).toBe(201);
    ownerToken = ownerResponse.body.token;

    const otherResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Collection Other",
        email: otherEmail,
        password,
      });

    expect(otherResponse.statusCode).toBe(201);
    otherUserToken = otherResponse.body.token;

    recipeId = await createRecipe(
      ownerToken,
      "Collection Pasta",
      "https://example.com/pasta.jpg"
    );

    secondRecipeId = await createRecipe(
      ownerToken,
      "Collection Salad"
    );
  });

  test("should reject collection access without authentication", async () => {
    const listResponse = await request(app).get("/api/collections");

    expect(listResponse.statusCode).toBe(401);

    const createResponse = await request(app)
      .post("/api/collections")
      .send({ name: "Weekend meals" });

    expect(createResponse.statusCode).toBe(401);
  });

  test("should create a collection", async () => {
    const response = await request(app)
      .post("/api/collections")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "Weekend meals" });

    expect(response.statusCode).toBe(201);
    expect(response.body.collection.name).toBe("Weekend meals");
    expect(response.body.collection.recipeCount).toBe(0);
    expect(response.body.collection.coverImage).toBeNull();

    collectionId = response.body.collection._id;
  });

  test("should reject invalid collection names", async () => {
    const emptyResponse = await request(app)
      .post("/api/collections")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "   " });

    expect(emptyResponse.statusCode).toBe(400);
    expect(emptyResponse.body).toHaveProperty("errors");

    const shortResponse = await request(app)
      .post("/api/collections")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ name: "a" });

    expect(shortResponse.statusCode).toBe(400);
  });

  test("should add and list recipes inside a collection", async () => {
    const addResponse = await request(app)
      .post(`/api/collections/${collectionId}/recipes`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ recipeId });

    expect(addResponse.statusCode).toBe(200);
    expect(addResponse.body.recipeCount).toBe(1);

    const detailResponse = await request(app)
      .get(`/api/collections/${collectionId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.body.collection.recipes).toHaveLength(1);
    expect(detailResponse.body.collection.recipes[0].title).toBe(
      "Collection Pasta"
    );

    // The cover falls back to the first recipe's image.
    const listResponse = await request(app)
      .get("/api/collections")
      .set("Authorization", `Bearer ${ownerToken}`);

    const savedCollection = listResponse.body.collections.find(
      (entry) => entry._id === collectionId
    );

    expect(savedCollection.coverImage).toBe(
      "https://example.com/pasta.jpg"
    );
    expect(savedCollection.recipeCount).toBe(1);
  });

  test("should reject adding the same recipe to a collection twice", async () => {
    const response = await request(app)
      .post(`/api/collections/${collectionId}/recipes`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ recipeId });

    expect(response.statusCode).toBe(409);
  });

  test("should reject invalid recipe ids when adding", async () => {
    const invalidResponse = await request(app)
      .post(`/api/collections/${collectionId}/recipes`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ recipeId: "not-a-valid-id" });

    expect(invalidResponse.statusCode).toBe(400);

    const missingResponse = await request(app)
      .post(`/api/collections/${collectionId}/recipes`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        recipeId: new Collection({})._id.toString(),
      });

    expect(missingResponse.statusCode).toBe(404);
  });

  test("should prevent users from modifying another user's collection", async () => {
    const addResponse = await request(app)
      .post(`/api/collections/${collectionId}/recipes`)
      .set("Authorization", `Bearer ${otherUserToken}`)
      .send({ recipeId: secondRecipeId });

    expect(addResponse.statusCode).toBe(403);

    const detailResponse = await request(app)
      .get(`/api/collections/${collectionId}`)
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(detailResponse.statusCode).toBe(403);

    const removeResponse = await request(app)
      .delete(`/api/collections/${collectionId}/recipes/${recipeId}`)
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(removeResponse.statusCode).toBe(403);
  });

  test("should remove a recipe from a collection", async () => {
    await request(app)
      .post(`/api/collections/${collectionId}/recipes`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ recipeId: secondRecipeId });

    const response = await request(app)
      .delete(`/api/collections/${collectionId}/recipes/${secondRecipeId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.recipeCount).toBe(1);

    // Removing it again has nothing left to remove.
    const repeatResponse = await request(app)
      .delete(`/api/collections/${collectionId}/recipes/${secondRecipeId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(repeatResponse.statusCode).toBe(404);
  });

  test("should paginate collections on the server with metadata", async () => {
    // Fill the other user's account with enough collections for two pages.
    for (let index = 1; index <= 11; index += 1) {
      const response = await request(app)
        .post("/api/collections")
        .set("Authorization", `Bearer ${otherUserToken}`)
        .send({ name: `Bulk collection ${index}` });

      expect(response.statusCode).toBe(201);
    }

    const firstPage = await request(app)
      .get("/api/collections?page=1&limit=5")
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(firstPage.statusCode).toBe(200);
    expect(firstPage.body.collections).toHaveLength(5);
    expect(firstPage.body.pagination).toEqual({
      page: 1,
      limit: 5,
      total: 11,
      totalPages: 3,
    });

    const lastPage = await request(app)
      .get("/api/collections?page=3&limit=5")
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(lastPage.body.collections).toHaveLength(1);

    // A page past the end returns an empty list but stays safe.
    const emptyPage = await request(app)
      .get("/api/collections?page=99&limit=5")
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(emptyPage.statusCode).toBe(200);
    expect(emptyPage.body.collections).toHaveLength(0);
    expect(emptyPage.body.pagination.total).toBe(11);

    // Invalid page values fall back to the first page.
    const invalidPage = await request(app)
      .get("/api/collections?page=abc&limit=5")
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(invalidPage.statusCode).toBe(200);
    expect(invalidPage.body.pagination.page).toBe(1);
    expect(invalidPage.body.collections).toHaveLength(5);
  });

  test("should return 404 for a missing collection and 400 for an invalid id", async () => {
    const missingId = new Collection({})._id.toString();

    const missingResponse = await request(app)
      .get(`/api/collections/${missingId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(missingResponse.statusCode).toBe(404);

    const invalidResponse = await request(app)
      .get("/api/collections/not-a-valid-id")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(invalidResponse.statusCode).toBe(400);
  });
});
