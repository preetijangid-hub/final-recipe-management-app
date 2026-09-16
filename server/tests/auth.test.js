const request = require("supertest");

const app = require("../server");

describe("Authentication API", () => {
  const testEmail = `testuser${Date.now()}@example.com`;
  const testPassword = "Test@12345";

  test("should register a new user", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test User",
        email: testEmail,
        password: testPassword,
      });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty("token");
    expect(response.body).toHaveProperty("user");
  });

  test("should login with valid credentials", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("token");
  });

  test("should reject invalid login credentials", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: testEmail,
        password: "WrongPassword123",
      });

    expect(response.statusCode).toBe(401);
  });

  test("should reject invalid registration data", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "",
        email: "invalid-email",
        password: "123",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body).toHaveProperty("errors");
  });
});