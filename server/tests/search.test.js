const request = require("supertest");

const app = require("../server");
const Recipe = require("../models/Recipe");
const Review = require("../models/Review");
const User = require("../models/User");
const {
  buildFilter,
  buildEnrichedPipeline,
  SORT_OPTIONS,
  toObjectId,
} = require("../utils/recipeHelpers");

// Every recipe created here carries this word in its description, so the
// suite can assert on exact result sets and orderings even though the test
// database is shared with the other suites.
const LABEL = "zsmartsearchlab";

const password = "Test@12345";

// Same rule as the trending endpoint: weeks start on Monday, server time.
const getWeekStart = () => {
  const weekStart = new Date();

  weekStart.setHours(0, 0, 0, 0);

  const daysSinceMonday = (weekStart.getDay() + 6) % 7;

  weekStart.setDate(weekStart.getDate() - daysSinceMonday);

  return weekStart;
};

describe("Smart search API", () => {
  let ownerToken;
  let recipeIds = {};
  const userTokens = [];
  const userIds = [];

  const registerUser = async (name) => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name,
        email: `${name.toLowerCase()}${Date.now()}-${userTokens.length}@example.com`,
        password,
      });

    expect(response.statusCode).toBe(201);

    userTokens.push(response.body.token);
    userIds.push(response.body.user.id);

    return response.body;
  };

  const createRecipe = async (payload) => {
    const response = await request(app)
      .post("/api/recipes")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        category: "Indian",
        mealCategory: "Dinner",
        steps: ["Prepare the ingredients", "Cook everything together"],
        ...payload,
      });

    expect(response.statusCode).toBe(201);

    return response.body.recipe;
  };

  const addReview = async (recipeId, token, rating, comment) => {
    const response = await request(app)
      .post(`/api/recipes/${recipeId}/reviews`)
      .set("Authorization", `Bearer ${token}`)
      .send({ rating, comment });

    expect(response.statusCode).toBe(201);
  };

  const backdateReviews = async (recipeKey, userList) => {
    const tenDaysAgo = new Date(
      Date.now() - 10 * 24 * 60 * 60 * 1000
    );

    const objectIds = userList
      .filter(Boolean)
      .map((userId) => toObjectId(userId));

    // The raw collection call is used on purpose: Mongoose manages
    // createdAt itself and would otherwise overwrite the backdated value.
    await Review.collection.updateMany(
      {
        recipe: toObjectId(recipeIds[recipeKey]),
        user: { $in: objectIds },
      },
      { $set: { createdAt: tenDaysAgo } }
    );
  };

  // The text index has to exist before any search runs.
  beforeAll(async () => {
    await Recipe.init();
    await Review.init();

    // The test database is shared with the other suites and is not wiped
    // between runs, so the data of earlier runs of this file is removed
    // first. Recipes are recognised by the label in their description.
    const previousRecipes = await Recipe.find({
      description: { $regex: LABEL },
    }).select("_id");

    await Review.deleteMany({
      recipe: { $in: previousRecipes.map((recipe) => recipe._id) },
    });

    await Recipe.deleteMany({
      _id: { $in: previousRecipes.map((recipe) => recipe._id) },
    });

    await User.deleteMany({
      email: { $regex: /^search(user|owner)/ },
    });

    const owner = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Search Owner",
        email: `searchowner${Date.now()}@example.com`,
        password,
      });

    expect(owner.statusCode).toBe(201);

    ownerToken = owner.body.token;

    for (let index = 0; index < 5; index++) {
      await registerUser(`SearchUser${index}`);
    }


    const curry = await createRecipe({
      title: "Saffron Chicken Curry",
      description: `${LABEL} Slow simmered chicken in a creamy saffron gravy.`,
      ingredients: ["Chicken", "Saffron", "Yogurt"],
      cookingTime: 45,
    });

    const pasta = await createRecipe({
      title: "Basil Tomato Pasta",
      description: `${LABEL} Fresh basil and tomato sauce tossed with spaghetti.`,
      ingredients: ["Spaghetti", "Tomato", "Basil"],
      cookingTime: 25,
    });

    const paneer = await createRecipe({
      title: "Paneer Tikka Skewers",
      description: `${LABEL} Grilled paneer cubes with a smoky chilli marinade.`,
      ingredients: ["Paneer", "Yogurt", "Chilli"],
      cookingTime: 35,
    });

    const oats = await createRecipe({
      title: "Honey Overnight Oats",
      description: `${LABEL} Creamy oats soaked overnight with honey.`,
      ingredients: ["Oats", "Milk", "Honey"],
      cookingTime: 5,
    });

    const stale = await createRecipe({
      title: "Stale Casserole",
      description: `${LABEL} A potato bake nobody talks about any more.`,
      ingredients: ["Potato", "Cheese"],
      cookingTime: 50,
    });

    recipeIds = {
      curry: curry._id,
      pasta: pasta._id,
      paneer: paneer._id,
      oats: oats._id,
      stale: stale._id,
    };

    // Ratings and reviews that fall inside the current week.
    await addReview(recipeIds.curry, userTokens[0], 5, "Wonderful curry.");
    await addReview(recipeIds.curry, userTokens[1], 5, "Rich and creamy.");
    await addReview(recipeIds.curry, userTokens[2], 4, "Good weeknight dinner.");
    await addReview(recipeIds.pasta, userTokens[0], 3, "Nice but plain.");
    await addReview(recipeIds.paneer, userTokens[1], 2, "Too dry for me.");

    // Two older reviews for the curry and three for the casserole, so the
    // lifetime counts never match the weekly counts in this suite.
    await addReview(recipeIds.curry, userTokens[3], 4, "Made it last month.");
    await addReview(recipeIds.curry, userTokens[4], 4, "Also good in winter.");
    await addReview(recipeIds.stale, userTokens[0], 4, "Fine, long ago.");
    await addReview(recipeIds.stale, userTokens[3], 4, "Old favourite.");
    await addReview(recipeIds.stale, userTokens[4], 4, "We used to love it.");

    await backdateReviews("curry", [userIds[3], userIds[4]]);
    await backdateReviews("stale", userIds);
  }, 60000);


  const fetchRecipes = async (queryString) => {
    const response = await request(app).get(`/api/recipes?${queryString}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("recipes");
    expect(response.body.pagination).toHaveProperty("total");

    return response.body;
  };

  const titlesOf = (body) => body.recipes.map((recipe) => recipe.title);

  test("finds recipes by title, description and ingredients", async () => {
    const byTitle = await fetchRecipes("search=saffron");
    expect(titlesOf(byTitle)).toContain("Saffron Chicken Curry");

    const byDescription = await fetchRecipes("search=smoky");
    expect(titlesOf(byDescription)).toContain("Paneer Tikka Skewers");

    const byIngredient = await fetchRecipes("search=spaghetti");
    expect(titlesOf(byIngredient)).toContain("Basil Tomato Pasta");

    // A word that appears in no recipe field returns an empty page instead
    // of an error.
    const empty = await fetchRecipes("search=zzzznotarecipeword");

    expect(empty.recipes).toHaveLength(0);
    expect(empty.pagination.total).toBe(0);
  });

  test("returns descriptions and cooking times in the recipe list", async () => {
    const body = await fetchRecipes(`search=${LABEL}&sort=cookingTimeAsc`);
    const curry = body.recipes.find(
      (recipe) => recipe.title === "Saffron Chicken Curry"
    );

    expect(curry.cookingTime).toBe(45);
    expect(curry.description).toContain(LABEL);
  });

  test("combines ingredient, cooking time and rating filters", async () => {
    const body = await fetchRecipes(
      `search=${LABEL}&ingredients=Yogurt&ingredients=Chilli&maxCookingTime=40&minRating=1`
    );

    // Only the paneer recipe has both ingredients and fits in 40 minutes.
    expect(titlesOf(body)).toEqual(["Paneer Tikka Skewers"]);
  });

  test("matches every picked pantry ingredient with Cook With What I Have", async () => {
    const body = await fetchRecipes("ingredients=Yogurt&ingredients=Chicken");

    const titles = titlesOf(body);

    expect(titles).toContain("Saffron Chicken Curry");
    expect(titles).not.toContain("Basil Tomato Pasta");
    expect(titles).not.toContain("Honey Overnight Oats");
  });

  test("filters by minimum rating without counting unrated recipes", async () => {
    const body = await fetchRecipes(
      `search=${LABEL}&minRating=4&sort=rating`
    );

    // The curry averages 4.4 and the casserole 4.0; pasta, paneer and the
    // unrated oats are left out.
    expect(titlesOf(body)).toEqual([
      "Saffron Chicken Curry",
      "Stale Casserole",
    ]);
  });

  test("ignores invalid filter values instead of failing", async () => {
    const body = await fetchRecipes(
      `search=${LABEL}&maxCookingTime=notanumber&minRating=99&sort=banana&ingredients=`
    );

    // The unknown sort falls back to newest first and the other filters are
    // dropped, so all five labelled recipes come back.
    expect(body.pagination.total).toBe(5);
    expect(titlesOf(body)).toEqual([
      "Stale Casserole",
      "Honey Overnight Oats",
      "Paneer Tikka Skewers",
      "Basil Tomato Pasta",
      "Saffron Chicken Curry",
    ]);
  });

  test("sorts by newest, rating, review count and cooking time", async () => {
    const oldest = await fetchRecipes(`search=${LABEL}&sort=oldest`);
    expect(titlesOf(oldest)[0]).toBe("Saffron Chicken Curry");

    const newest = await fetchRecipes(`search=${LABEL}&sort=newest`);
    expect(titlesOf(newest)[0]).toBe("Stale Casserole");

    const byRating = await fetchRecipes(`search=${LABEL}&sort=rating`);
    expect(titlesOf(byRating)).toEqual([
      "Saffron Chicken Curry",
      "Stale Casserole",
      "Basil Tomato Pasta",
      "Paneer Tikka Skewers",
      "Honey Overnight Oats",
    ]);

    const byReviews = await fetchRecipes(`search=${LABEL}&sort=reviewed`);
    expect(titlesOf(byReviews)).toEqual([
      "Saffron Chicken Curry",
      "Stale Casserole",
      "Basil Tomato Pasta",
      "Paneer Tikka Skewers",
      "Honey Overnight Oats",
    ]);

    const quickest = await fetchRecipes(`search=${LABEL}&sort=cookingTimeAsc`);
    expect(
      quickest.recipes.map((recipe) => recipe.cookingTime)
    ).toEqual([5, 25, 35, 45, 50]);

    const slowest = await fetchRecipes(`search=${LABEL}&sort=cookingTimeDesc`);
    expect(
      slowest.recipes.map((recipe) => recipe.cookingTime)
    ).toEqual([50, 45, 35, 25, 5]);
  });

  test("paginates search results together with the filters", async () => {
    const firstPage = await fetchRecipes(`search=${LABEL}&limit=2&page=1`);

    expect(firstPage.recipes).toHaveLength(2);
    expect(firstPage.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 5,
      totalPages: 3,
    });

    const thirdPage = await fetchRecipes(`search=${LABEL}&limit=2&page=3`);

    expect(thirdPage.recipes).toHaveLength(1);
    expect(titlesOf(thirdPage)).toEqual(["Saffron Chicken Curry"]);

    const filtered = await fetchRecipes(
        `search=${LABEL}&maxCookingTime=35&minRating=1&limit=1&page=2&sort=cookingTimeAsc`
    );

    // Pasta and paneer match; the slower paneer is the second result.
    expect(filtered.pagination.total).toBe(2);
    expect(titlesOf(filtered)).toEqual(["Paneer Tikka Skewers"]);
  });
  test("trending counts only reviews from the current week", async () => {
    const response = await request(app).get("/api/recipes/trending");

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.trending)).toBe(true);

    const weekStart = new Date(response.body.weekStart);
    const weekEnd = new Date(response.body.weekEnd);
    const expectedWeekEnd = new Date(weekStart);
    expectedWeekEnd.setDate(expectedWeekEnd.getDate() + 7);

    // Weeks start on Monday in the server timezone and cover seven days.
    expect(weekStart.getDay()).toBe(1);
    expect(weekStart.getTime()).toBe(getWeekStart().getTime());
    expect(weekEnd.getDay()).toBe(1);
    expect(weekEnd.getTime()).toBe(expectedWeekEnd.getTime());

    const curry = response.body.trending.find(
      (recipe) => recipe.title === "Saffron Chicken Curry"
    );

    expect(curry).toBeDefined();
    expect(curry.weekly.reviews).toBe(3);
    expect(curry.weekly.averageRating).toBe(4.7);

    // Lifetime data is reported separately: five reviews, not three.
    expect(curry.rating.count).toBe(5);

    // Every entry is backed by at least one review from this week.
    response.body.trending.forEach((recipe) => {
      expect(recipe.weekly.reviews).toBeGreaterThan(0);
      expect(new Date(recipe.weekly.lastReviewAt).getTime()).toBeGreaterThanOrEqual(
        weekStart.getTime()
      );
    });

    // The casserole has three reviews in total, but none of them are from
    // this week, so it must not be treated as trending.
    const stale = response.body.trending.find(
      (recipe) => recipe.title === "Stale Casserole"
    );

    expect(stale).toBeUndefined();
  });

  test("ranks trending recipes by review activity of the week", async () => {
    const response = await request(app).get("/api/recipes/trending");

    const counts = response.body.trending.map(
      (recipe) => recipe.weekly.reviews
    );

    const sortedCounts = [...counts].sort((a, b) => b - a);

    expect(counts).toEqual(sortedCounts);
    expect(counts[0]).toBeGreaterThanOrEqual(3);
  });

  test("explains that the search query uses the text index", async () => {
    const match = buildFilter("saffron curry", "", "", {});
    const pipeline = buildEnrichedPipeline(
      match,
      SORT_OPTIONS.newest,
      null,
      null
    );

    const explanation = await Recipe.aggregate(pipeline).explain(
      "executionStats"
    );

    const plan = JSON.stringify(explanation.queryPlanner ?? explanation);

    // The plan has to name the text index and must not fall back to a
    // collection scan.
    expect(plan).toContain("recipe_search_text");
    expect(plan).not.toContain("COLLSCAN");
  });

  test("explains that the trending query uses the review date index", async () => {
    const explanation = await Review.aggregate([
      {
        $match: {
          createdAt: {
            $gte: getWeekStart(),
            $lt: new Date(getWeekStart().getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: "$recipe",
          reviewCount: { $sum: 1 },
        },
      },
      { $sort: { reviewCount: -1 } },
    ]).explain("executionStats");

    const plan = JSON.stringify(explanation.queryPlanner ?? explanation);

    expect(plan).toContain("IXSCAN");
    expect(plan).toContain("createdAt_-1");
    expect(plan).not.toContain("COLLSCAN");
  });

});
