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
        category: "Dinner",
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
        category: "Breakfast",
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
        category: "Lunch",
        user: admin._id,
      },
    ]);

    console.log("Database seeded successfully.");
    console.log("Admin: admin@recipeapp.com");
    console.log("User: user@recipeapp.com");
    console.log("Sample recipes: 3");

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