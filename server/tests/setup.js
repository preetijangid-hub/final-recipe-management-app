const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Load .env only for non-database values such as the JWT secret. The test
// database itself always comes from the in-memory server below, never from
// the real MongoDB configured for development or production.
dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

// Test-only fallbacks so GitHub Actions can run without the local .env file.
// Existing local .env values take precedence when present.
process.env.JWT_SECRET = process.env.JWT_SECRET || "savore-test-jwt-secret";

process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();

  const uri = mongoServer.getUri();

  process.env.MONGODB_URI = uri;

  await mongoose.connect(uri);
}, 120000);

afterAll(async () => {
  // Close the driver first so the in-memory server can stop cleanly.
  await mongoose.connection.close();

  if (mongoServer) {
    await mongoServer.stop();

    mongoServer = null;
  }
});