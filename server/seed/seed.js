const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const User = require("../models/User");
const Recipe = require("../models/Recipe");

dotenv.config();

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log("Clearing existing seed data...");

    const seedEmails = [
      "admin@recipeapp.com",
      "user@recipeapp.com",
      "cook@recipeapp.com",
    ];

    const existingUsers = await User.find({
      email: { $in: seedEmails },
    }).select("_id");

    const existingUserIds = existingUsers.map((user) => user._id);

    if (existingUserIds.length > 0) {
      await Recipe.deleteMany({
        user: { $in: existingUserIds },
      });

      await User.deleteMany({
        _id: { $in: existingUserIds },
      });
    }

    // Recipes whose owner no longer exists never show an author and are
    // dropped from list responses, so they are removed during seeding too.
    const remainingUsers = await User.find().select("_id");

    const orphanRemoval = await Recipe.deleteMany({
      user: { $nin: remainingUsers.map((existingUser) => existingUser._id) },
    });

    if (orphanRemoval.deletedCount > 0) {
      console.log(
        `Removed ${orphanRemoval.deletedCount} recipes with missing owners.`
      );
    }

    const adminPassword = await bcrypt.hash("Admin@12345", 12);
    const userPassword = await bcrypt.hash("User@12345", 12);
    
    const admin = await User.create({
      name: "Recipe Admin",
      email: "admin@recipeapp.com",
      password: adminPassword,
      role: "admin",
    });

    const user = await User.create({
      name: "Recipe User",
      email: "user@recipeapp.com",
      password: userPassword,
      role: "user",
    });

    const cook = await User.create({
      name: "Demo Cook",
      email: "cook@recipeapp.com",
      password: userPassword,
      role: "user",
    });

    await Recipe.insertMany([
      {
        title: "Paneer Butter Masala",
        ingredients: [
          "Paneer",
          "Butter",
          "Tomatoes",
          "Cream",
          "Garam Masala",
        ],
        steps: [
          "Prepare the tomato gravy.",
          "Add butter and spices.",
          "Add paneer cubes.",
          "Add cream and simmer.",
        ],
        category: "Indian",
        mealCategory: "Dinner",
        spiceLevel: "Medium",
        user: user._id,
      },
      {
        title: "Masala Dosa",
        ingredients: [
          "Dosa Batter",
          "Potatoes",
          "Onion",
          "Mustard Seeds",
          "Curry Leaves",
        ],
        steps: [
          "Prepare potato masala.",
          "Heat the dosa pan.",
          "Spread the dosa batter.",
          "Add potato filling and serve.",
        ],
        category: "Indian",
        mealCategory: "Breakfast",
        user: user._id,
      },
      {
        title: "Virgin Mojito",
        ingredients: [
          "Lime",
          "Mint Leaves",
          "Sugar Syrup",
          "Soda",
          "Ice",
        ],
        steps: [
          "Muddle lime and mint with sugar syrup.",
          "Fill the glass with ice.",
          "Top with soda and stir gently.",
        ],
        category: "Mediterranean",
        mealCategory: "Drinks",
        sweetnessLevel: "Lightly Sweet",
        user: user._id,
      },
      {
        title: "Vegetable Pulao",
        ingredients: [
          "Basmati Rice",
          "Carrot",
          "Peas",
          "Beans",
          "Whole Spices",
        ],
        steps: [
          "Wash and soak the rice.",
          "Saute vegetables and spices.",
          "Add rice and water.",
          "Cook until the rice is tender.",
        ],
        category: "Indian",
        mealCategory: "Lunch",
        user: admin._id,
      },
      {
        title: "Thai Green Curry",
        ingredients: [
          "Green Curry Paste",
          "Coconut Milk",
          "Thai Basil",
          "Baby Corn",
          "Tofu",
        ],
        steps: [
          "Fry the curry paste in oil.",
          "Add coconut milk and vegetables.",
          "Simmer until the vegetables are cooked.",
          "Finish with Thai basil.",
        ],
        category: "Thai",
        mealCategory: "Dinner",
        spiceLevel: "Hot",
        user: admin._id,
      },
      {
        title: "Margherita Pizza",
        ingredients: [
          "Pizza Dough",
          "Tomato Sauce",
          "Mozzarella",
          "Fresh Basil",
          "Olive Oil",
        ],
        steps: [
          "Roll out the dough and spread the sauce.",
          "Add mozzarella and basil.",
          "Bake at high heat until the crust is golden.",
        ],
        category: "Italian",
        mealCategory: "Dinner",
        user: cook._id,
      },
      {
        title: "Spaghetti Aglio e Olio",
        ingredients: [
          "Spaghetti",
          "Garlic",
          "Olive Oil",
          "Chilli Flakes",
          "Parsley",
        ],
        steps: [
          "Cook the spaghetti until al dente.",
          "Slowly fry sliced garlic in olive oil.",
          "Toss the pasta with the garlic oil and chilli flakes.",
          "Finish with chopped parsley.",
        ],
        category: "Italian",
        mealCategory: "Lunch",
        spiceLevel: "Medium",
        user: cook._id,
      },
      {
        title: "Blueberry Pancakes",
        ingredients: [
          "Flour",
          "Milk",
          "Eggs",
          "Blueberries",
          "Maple Syrup",
        ],
        steps: [
          "Whisk the batter until smooth.",
          "Fold in the blueberries.",
          "Cook pancakes on a greased pan.",
          "Serve warm with maple syrup.",
        ],
        category: "American",
        mealCategory: "Breakfast",
        sweetnessLevel: "Sweet",
        user: cook._id,
      },
      {
        title: "Chocolate Lava Cake",
        ingredients: [
          "Dark Chocolate",
          "Butter",
          "Eggs",
          "Sugar",
          "Flour",
        ],
        steps: [
          "Melt chocolate and butter together.",
          "Whisk eggs and sugar until fluffy.",
          "Fold in the chocolate and flour.",
          "Bake until the centre is still molten.",
        ],
        category: "French",
        mealCategory: "Dessert",
        sweetnessLevel: "Very Sweet",
        user: cook._id,
      },
      {
        title: "Vada Pav",
        ingredients: [
          "Pav Buns",
          "Potato",
          "Green Chutney",
          "Garlic Chutney",
          "Gram Flour",
        ],
        steps: [
          "Make spiced potato vadas and dip in gram flour batter.",
          "Deep fry until golden.",
          "Serve in pav buns with both chutneys.",
        ],
        category: "Indian",
        mealCategory: "Snacks",
        spiceLevel: "Hot",
        user: user._id,
      },
    ]);

    console.log("Database seeded successfully.");
    console.log("Admin: admin@recipeapp.com / Admin@12345");
    console.log("User: user@recipeapp.com / User@12345");
    console.log("Second user: cook@recipeapp.com / User@12345");
    console.log("Sample recipes: 10");

    await mongoose.connection.close();
    console.log("MongoDB connection closed.");

    process.exit(0);
  } catch (error) {
    console.error("Seed error:", error.message);

    await mongoose.connection.close();

    process.exit(1);
  }
};

seedDatabase();