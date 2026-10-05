const request = require("supertest");

const app = require("../server");
const Recipe = require("../models/Recipe");
const ShoppingList = require("../models/ShoppingList");
const User = require("../models/User");

describe("Shopping list API", () => {
  let token;
  let userId;
  let recipeId;
  const password = "Test@12345";
  const email = `shopper${Date.now()}@example.com`;

  beforeAll(async () => {
    const user = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Shopper User",
        email,
        password,
      });

    expect(user.statusCode).toBe(201);
    token = user.body.token;
    userId = user.body.user.id;

    const recipe = await request(app)
      .post("/api/recipes")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Scale Up Bowl",
        ingredients: [
          "2 tomatoes",
          "3 tomatoes",
          "1 cup rice",
          "2 cups rice",
          "500 g flour",
          "250 g flour",
        ],
        steps: ["Prep it.", "Cook it."],
        category: "Indian",
        mealCategory: "Dinner",
      });

    expect(recipe.statusCode).toBe(201);
    recipeId = recipe.body.recipe._id;
  });

  test("generates and persists a shopping list from meal plans with serving scaling", async () => {
    const date = "2026-11-09";

    const mealPlan = await request(app)
      .post("/api/meal-plans")
      .set("Authorization", `Bearer ${token}`)
      .send({
        date,
        mealType: "lunch",
        recipe: recipeId,
        servings: 2,
      });

    expect(mealPlan.statusCode).toBe(201);

    const shoppingListResponse = await request(app)
      .get(`/api/shopping-lists?weekStart=${date}`)
      .set("Authorization", `Bearer ${token}`);

    expect(shoppingListResponse.statusCode).toBe(200);
    expect(shoppingListResponse.body.shoppingList.user).toBe(userId);

    const tomatoes = shoppingListResponse.body.shoppingList.items.find((item) => item.name === "Tomatoes");
    const rice = shoppingListResponse.body.shoppingList.items.find((item) => item.name === "Rice");
    const flour = shoppingListResponse.body.shoppingList.items.find((item) => item.name === "Flour");

    expect(tomatoes).toEqual(
      expect.objectContaining({
        name: "Tomatoes",
        quantity: 10,
        unit: "",
      })
    );
    expect(rice).toEqual(
      expect.objectContaining({
        name: "Rice",
        quantity: 6,
        unit: "cup",
      })
    );
    expect(flour).toEqual(
      expect.objectContaining({
        name: "Flour",
        quantity: 1500,
        unit: "g",
      })
    );
  });

  test("stores checkbox state for each ingredient item", async () => {
    const date = "2026-11-10";
    const mealPlan = await request(app)
      .post("/api/meal-plans")
      .set("Authorization", `Bearer ${token}`)
      .send({
        date,
        mealType: "dinner",
        recipe: recipeId,
        servings: 1,
      });

    expect(mealPlan.statusCode).toBe(201);

    const listResponse = await request(app)
      .get(`/api/shopping-lists?weekStart=${date}`)
      .set("Authorization", `Bearer ${token}`);

    const shoppingListId = listResponse.body.shoppingList._id;
    const item = listResponse.body.shoppingList.items.find((entry) => entry.name === "Tomatoes");

    expect(item).toBeTruthy();

    const toggleResponse = await request(app)
      .patch(`/api/shopping-lists/${shoppingListId}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        itemName: item.name,
        checked: true,
      });

    expect(toggleResponse.statusCode).toBe(200);
    expect(toggleResponse.body.shoppingList.items.find((entry) => entry.name === "Tomatoes").checked).toBe(true);

    const refetch = await request(app)
      .get(`/api/shopping-lists?weekStart=${date}`)
      .set("Authorization", `Bearer ${token}`);

    expect(refetch.body.shoppingList.items.find((entry) => entry.name === "Tomatoes").checked).toBe(true);
  });

  afterAll(async () => {
    await ShoppingList.deleteMany({ user: userId });
    await Recipe.deleteMany({ user: userId });
    await User.deleteMany({ email });
  });
});
