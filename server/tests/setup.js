const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const createTestDatabaseUri = () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  const databaseUri = new URL(uri);
  databaseUri.pathname = "/recipe_management_test";

  return databaseUri.toString();
};

process.env.MONGODB_URI = createTestDatabaseUri();

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  await mongoose.connection.close();
});