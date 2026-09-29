const request = require("supertest");

const app = require("../server");
const Collection = require("../models/Collection");

describe("Public collection sharing API", () => {
  let ownerToken;
  let otherUserToken;
  let collectionId;
  let recipeId;
  let shareToken;

  const password = "Test@12345";

  const ownerEmail = `share-owner${Date.now()}@example.com`;
  const otherEmail = `share-other${Date.now()}@example.com`;

  beforeAll(async () => {
    const ownerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Share Owner",
        email: ownerEmail,
        password,
      });

    expect(ownerResponse.statusCode).toBe(201);
    ownerToken = ownerResponse.body.token;

    const otherResponse = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Share Other",
        email: otherEmail,
        password,
      });

    expect(otherResponse.statusCode).toBe(201);
    otherUserToken = otherResponse.body.token;

    const recipeResponse = await request(app)
      .post("/api/recipes")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        title: "Shared Pasta",
        ingredients: ["Ingredient 1"],
        steps: ["Step 1"],
        category: "Italian",
        mealCategory: "Dinner",
        image: "https://example.com/shared-pasta.jpg",
      });

    expect(recipeResponse.statusCode).toBe(201);
    recipeId = recipeResponse.body.recipe._id;

    const collectionResponse = await request(app)
      .post("/api/collections")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "Shared shelf",
        description: "Recipes I cook on Sundays",
        coverImage: "https://res.cloudinary.com/demo/image/upload/cover.jpg",
      });

    expect(collectionResponse.statusCode).toBe(201);
    collectionId = collectionResponse.body.collection._id;
    expect(collectionResponse.body.collection.shareToken).toBeNull();

    await request(app)
      .post(`/api/collections/${collectionId}/recipes`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ recipeId });
  });

  test("should not expose the collection publicly before sharing is enabled", async () => {
    const stored = await Collection.findById(collectionId);

    expect(stored.shareToken).toBeUndefined();

    const response = await request(app).get(
      `/api/public/collections/${collectionId}`
    );

    // The collection id is not a share token, so nothing is returned.
    expect(response.statusCode).toBe(404);
  });

  test("should reject sharing attempts from another user", async () => {
    const enableResponse = await request(app)
      .post(`/api/collections/${collectionId}/share`)
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(enableResponse.statusCode).toBe(403);

    const regenerateResponse = await request(app)
      .post(`/api/collections/${collectionId}/share/regenerate`)
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(regenerateResponse.statusCode).toBe(403);

    const disableResponse = await request(app)
      .delete(`/api/collections/${collectionId}/share`)
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(disableResponse.statusCode).toBe(403);
  });

  test("should reject sharing without authentication", async () => {
    const response = await request(app).post(
      `/api/collections/${collectionId}/share`
    );

    expect(response.statusCode).toBe(401);
  });

  test("should let the owner enable sharing with a random token", async () => {
    const response = await request(app)
      .post(`/api/collections/${collectionId}/share`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.statusCode).toBe(200);

    shareToken = response.body.collection.shareToken;

    expect(shareToken).toMatch(/^[A-Za-z0-9_-]{20,64}$/);
    expect(shareToken).not.toBe(collectionId);
  });

  test("should return only safe read-only data for a valid link", async () => {
    const response = await request(app).get(
      `/api/public/collections/${shareToken}`
    );

    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.body.collection).sort()).toEqual([
      "coverImage",
      "description",
      "name",
      "recipeCount",
      "recipes",
    ]);

    const collection = response.body.collection;

    expect(collection.name).toBe("Shared shelf");
    expect(collection.description).toBe("Recipes I cook on Sundays");
    expect(collection.coverImage).toBe(
      "https://res.cloudinary.com/demo/image/upload/cover.jpg"
    );
    expect(collection.recipeCount).toBe(1);
    expect(Object.keys(collection.recipes[0]).sort()).toEqual([
      "_id",
      "category",
      "image",
      "title",
    ]);
    expect(collection.recipes[0].title).toBe("Shared Pasta");

    // No owner or account details may leak through the public endpoint.
    const body = JSON.stringify(response.body);

    expect(body).not.toContain(ownerEmail);
    expect(body).not.toContain(collectionId);
    expect(body).not.toContain(shareToken);
    expect(body).not.toContain("shareToken");
    expect(body).not.toContain("user");
  });

  test("should not let public visitors change anything", async () => {
    const addRecipeResponse = await request(app)
      .post(`/api/public/collections/${shareToken}/recipes`)
      .send({ recipeId });

    expect(addRecipeResponse.statusCode).toBe(404);

    const coverResponse = await request(app)
      .patch(`/api/collections/${collectionId}/cover`)
      .send({ coverImage: "https://example.com/hacked.jpg" });

    expect(coverResponse.statusCode).toBe(401);

    const stored = await Collection.findById(collectionId);

    expect(stored.recipes).toHaveLength(1);
    expect(stored.coverImage).toBe(
      "https://res.cloudinary.com/demo/image/upload/cover.jpg"
    );
  });

  test("should reject unknown and malformed share tokens", async () => {
    const unknownResponse = await request(app).get(
      "/api/public/collections/aaaaaaaaaaaaaaaaaaaaaaaa"
    );

    expect(unknownResponse.statusCode).toBe(404);

    const malformedResponse = await request(app).get(
      "/api/public/collections/short"
    );

    expect(malformedResponse.statusCode).toBe(400);
  });

  test("should invalidate the old link when sharing is switched off", async () => {
    const disableResponse = await request(app)
      .delete(`/api/collections/${collectionId}/share`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(disableResponse.statusCode).toBe(200);
    expect(disableResponse.body.collection.shareToken).toBeNull();

    const publicResponse = await request(app).get(
      `/api/public/collections/${shareToken}`
    );

    expect(publicResponse.statusCode).toBe(404);
  });

  test("should invalidate the previous link when a new one is generated", async () => {
    const firstResponse = await request(app)
      .post(`/api/collections/${collectionId}/share`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(firstResponse.statusCode).toBe(200);

    const firstToken = firstResponse.body.collection.shareToken;

    const secondResponse = await request(app)
      .post(`/api/collections/${collectionId}/share/regenerate`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(secondResponse.statusCode).toBe(200);

    const secondToken = secondResponse.body.collection.shareToken;

    expect(secondToken).not.toBe(firstToken);

    const freshResponse = await request(app).get(
      `/api/public/collections/${secondToken}`
    );

    expect(freshResponse.statusCode).toBe(200);

    const staleResponse = await request(app).get(
      `/api/public/collections/${firstToken}`
    );

    expect(staleResponse.statusCode).toBe(404);
  });

  test("should send the share state only to the owner", async () => {
    const ownerList = await request(app)
      .get("/api/collections")
      .set("Authorization", `Bearer ${ownerToken}`);

    const ownCollection = ownerList.body.collections.find(
      (collection) => collection._id === collectionId
    );

    expect(ownCollection.shareToken).toMatch(/^[A-Za-z0-9_-]{20,64}$/);

    const otherList = await request(app)
      .get("/api/collections")
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(otherList.body.collections).toHaveLength(0);
  });
});
