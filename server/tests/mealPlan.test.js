const request = require("supertest");

const app = require("../server");
const Recipe = require("../models/Recipe");
const User = require("../models/User");
const MealPlan = require("../models/MealPlan");

describe("Meal planner API", () => {
  let ownerToken;
  let ownerUserId;
  let otherToken;
  let recipeId;
  let secondRecipeId;

  const password = "Test@12345";
  const ownerEmail = `mealowner${Date.now()}@example.com`;
  const otherEmail = `mealother${Date.now()}@example.com`;

  beforeAll(async () => {
    const owner = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Meal Owner",
        email: ownerEmail,
        password,
      });

    expect(owner.statusCode).toBe(201);
    ownerToken = owner.body.token;
    ownerUserId = owner.body.user.id;

    const other = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Meal Other",
        email: otherEmail,
        password,
      });

    expect(other.statusCode).toBe(201);
    otherToken = other.body.token;

    const recipe = await request(app)
      .post("/api/recipes")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        title: "Meal Tray Bake",
        ingredients: ["Potatoes", "Onions"],
        steps: ["Bake it."],
        category: "Indian",
        mealCategory: "Dinner",
      });

    const secondRecipe = await request(app)
      .post("/api/recipes")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        title: "Pancakes",
        ingredients: ["Flour", "Eggs"],
        steps: ["Mix and pan-fry."],
        category: "Indian",
        mealCategory: "Breakfast",
      });

    expect(recipe.statusCode).toBe(201);
    expect(secondRecipe.statusCode).toBe(201);
    recipeId = recipe.body.recipe._id;
    secondRecipeId = secondRecipe.body.recipe._id;
  });

  test("should create and retrieve a weekly meal plan for the signed-in user", async () => {
    const weekStart = "2026-10-05";

    const createResponse = await request(app)
      .post("/api/meal-plans")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        date: weekStart,
        mealType: "breakfast",
        recipe: recipeId,
        servings: 2,
      });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.body.mealPlan.mealType).toBe("breakfast");

    const listResponse = await request(app)
      .get(`/api/meal-plans?weekStart=${weekStart}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.body.mealPlans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: weekStart,
          mealType: "breakfast",
        }),
      ])
    );
  });

  test("should append multiple recipes to the same slot without duplicating a recipe", async () => {
    const date = "2026-10-06";

    const first = await request(app)
      .post("/api/meal-plans")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        date,
        mealType: "breakfast",
        recipe: recipeId,
        servings: 1,
      });

    const second = await request(app)
      .post("/api/meal-plans")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        date,
        mealType: "breakfast",
        recipe: secondRecipeId,
        servings: 2,
      });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.body.mealPlan.recipes).toHaveLength(2);

    const duplicate = await request(app)
      .post("/api/meal-plans")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        date,
        mealType: "breakfast",
        recipe: secondRecipeId,
        servings: 4,
      });

    expect(duplicate.statusCode).toBe(201);
    expect(duplicate.body.mealPlan.recipes).toHaveLength(2);
  });

  test("should remove only one recipe from a slot while keeping the others", async () => {
    const date = "2026-10-07";

    const created = await request(app)
      .post("/api/meal-plans")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        date,
        mealType: "lunch",
        recipe: recipeId,
        servings: 1,
      });

    await request(app)
      .post("/api/meal-plans")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        date,
        mealType: "lunch",
        recipe: secondRecipeId,
        servings: 1,
      });

    const remove = await request(app)
      .delete(`/api/meal-plans/${created.body.mealPlan._id}/recipes/${recipeId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(remove.statusCode).toBe(200);
    expect(remove.body.emptied).toBe(false);

    const list = await request(app)
      .get(`/api/meal-plans?weekStart=${date}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    const slotMeals = list.body.mealPlans.filter((item) => item.mealType === "lunch" && item.date === date);
    expect(slotMeals).toHaveLength(1);
    expect(slotMeals[0].recipes).toHaveLength(1);
    expect(slotMeals[0].recipes[0]._id).toBe(secondRecipeId);
  });

  test("should delete the meal plan when the last recipe is removed", async () => {
    const date = "2026-10-08";

    const created = await request(app)
      .post("/api/meal-plans")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        date,
        mealType: "dinner",
        recipe: recipeId,
        servings: 2,
      });

    const remove = await request(app)
      .delete(`/api/meal-plans/${created.body.mealPlan._id}/recipes/${recipeId}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(remove.statusCode).toBe(200);
    expect(remove.body.emptied).toBe(true);

    const list = await request(app)
      .get(`/api/meal-plans?weekStart=${date}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(list.body.mealPlans).toEqual([]);
  });

  test("should prevent access to another user's meal plans", async () => {
    const date = "2026-10-09";

    await request(app)
      .post("/api/meal-plans")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        date,
        mealType: "dinner",
        recipe: recipeId,
        servings: 2,
      });

    const response = await request(app)
      .get(`/api/meal-plans?weekStart=${date}`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.mealPlans).toEqual([]);
  });

  afterAll(async () => {
    await MealPlan.deleteMany({ user: ownerUserId });
    await Recipe.deleteMany({ user: ownerUserId });
    await User.deleteMany({ email: { $in: [ownerEmail, otherEmail] } });
  });
});
