import request from "supertest";
import { createApp } from "../../src/api/app";
import { createTestAdmin } from "../factories";

const app = createApp();

describe("admin authentication API", () => {
  it("logs in with valid credentials and returns a JWT", async () => {
    await createTestAdmin({ email: "owner@example.com" });
    const res = await request(app).post("/api/v1/auth/login").send({ email: "owner@example.com", password: "Password123!" });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.admin.email).toBe("owner@example.com");
  });

  it("rejects invalid credentials", async () => {
    await createTestAdmin({ email: "owner2@example.com" });
    const res = await request(app).post("/api/v1/auth/login").send({ email: "owner2@example.com", password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects login for a non-existent admin", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email: "nobody@example.com", password: "whatever123" });
    expect(res.status).toBe(401);
  });

  it("blocks access to protected routes without a token", async () => {
    const res = await request(app).get("/api/v1/users");
    expect(res.status).toBe(401);
  });

  it("allows access to protected routes with a valid token", async () => {
    await createTestAdmin({ email: "owner3@example.com" });
    const login = await request(app).post("/api/v1/auth/login").send({ email: "owner3@example.com", password: "Password123!" });
    const token = login.body.data.token;

    const res = await request(app).get("/api/v1/users").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
