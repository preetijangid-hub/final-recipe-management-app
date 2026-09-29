const request = require("supertest");

const app = require("../server");
const Collection = require("../models/Collection");

describe("Collection cover images API", () => {
  let ownerToken;
  let otherUserToken;
  let collectionId;
  let recipeId;

  const password = "Test@12345";

  const ownerEmail = `cover-owner${Date.now()}@example.com`;
  const otherEmail = `cover-other${Date.now()}@example.com`;

  const coverUrl = "https://res.cloudinary.com/demo/image/upload/pasta.jpg";

  test("should allow browser preflight for cover updates", async () => {
    const response = await request(app)
      .options("/api/collections/507f1f77bcf86cd799439011/cover")
      .set("Origin", "http://localhost:4200")
      .set("Access-Control-Request-Method", "PATCH")
      .set("Access-Control-Request-Headers", "authorization,content-type");

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toContain(
      "PATCH"
    );
  });

  beforeAll(async () => {
    const ownerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Cover Owner",
        email: ownerEmail,
        password,
      });

    expect(ownerResponse.statusCode).toBe(201);
    ownerToken = ownerResponse.body.token;

    const otherResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Cover Other",
        email: otherEmail,
        password,
      });

    expect(otherResponse.statusCode).toBe(201);
    otherUserToken = otherResponse.body.token;

    const recipeResponse = await request(app)
      .post("/api/recipes")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        title: "Cover Pasta",
        ingredients: ["Ingredient 1"],
        steps: ["Step 1"],
        category: "Italian",
        mealCategory: "Dinner",
        image: "https://example.com/pasta.jpg",
      });

    expect(recipeResponse.statusCode).toBe(201);
    recipeId = recipeResponse.body.recipe._id;
  });

  test("should create a collection with a cover image and description", async () => {
    const response = await request(app)
      .post("/api/collections")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Covered shelf",
        description: "Slow cooking for cold evenings",
        coverImage: coverUrl,
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.collection.coverImage).toBe(coverUrl);
    expect(response.body.collection.description).toBe(
      "Slow cooking for cold evenings"
    );

    collectionId = response.body.collection._id;
  });

  test("should reject a cover image that is not a valid URL", async () => {
    const response = await request(app)
      .post("/api/collections")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Broken cover",
        coverImage: "not-a-url",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("errors");
  });

  test("should update the cover image of an existing collection", async () => {
    const response = await request(app)
      .patch(`/api/collections/${collectionId}/cover`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        coverImage: "https://res.cloudinary.com/demo/image/upload/salad.jpg",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.collection.coverImage).toBe(
      "https://res.cloudinary.com/demo/image/upload/salad.jpg"
    );

    const listResponse = await request(app)
      .get("/api/collections")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(listResponse.body.collections[0].coverImage).toBe(
      "https://res.cloudinary.com/demo/image/upload/salad.jpg"
    );
  });

  test("should fall back to the first recipe image when no cover is set", async () => {
    await request(app)
      .post(`/api/collections/${collectionId}/recipes`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ recipeId });

    const cleared = await request(app)
      .patch(`/api/collections/${collectionId}/cover`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ coverImage: "" });

    expect(cleared.statusCode).toBe(200);
    expect(cleared.body.collection.coverImage).toBeNull();

    const listResponse = await request(app)
      .get("/api/collections")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(listResponse.body.collections[0].coverImage).toBe(
      "https://example.com/pasta.jpg"
    );
  });

  test("should keep existing collections working without a cover field", async () => {
    // Documents saved before covers existed have no coverImage at all.
    const legacyCollection = await Collection.create({
      name: "Legacy shelf",
      user: (await Collection.findById(collectionId)).user,
    });

    const listResponse = await request(app)
      .get("/api/collections")
      .set("Authorization", `Bearer ${ownerToken}`);

    const legacySummary = listResponse.body.collections.find(
      (collection) => collection._id === legacyCollection._id.toString()
    );

    expect(legacySummary).toBeDefined();
    expect(legacySummary.coverImage).toBeNull();
  });

  test("should not let another user change someone else's cover", async () => {
    const response = await request(app)
      .patch(`/api/collections/${collectionId}/cover`)
      .set("Authorization", `Bearer ${otherUserToken}`)
      .send({ coverImage: coverUrl });

    expect(response.statusCode).toBe(403);
  });

  test("should reject cover changes without authentication", async () => {
    const response = await request(app)
      .patch(`/api/collections/${collectionId}/cover`)
      .send({ coverImage: coverUrl });

    expect(response.statusCode).toBe(401);
  });
});
