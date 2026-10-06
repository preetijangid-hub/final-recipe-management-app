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