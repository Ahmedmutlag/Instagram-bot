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

  it("logs in regardless of email casing on either side (stored or typed)", async () => {
    await createTestAdmin({ email: "Mixed.Case@Example.com" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "mixed.case@example.com", password: "Password123!" });

    expect(res.status).toBe(200);
    expect(res.body.data.admin.email).toBe("Mixed.Case@Example.com");
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

  it("changes the admin's own password and allows login with the new one", async () => {
    await createTestAdmin({ email: "owner4@example.com" });
    const login = await request(app).post("/api/v1/auth/login").send({ email: "owner4@example.com", password: "Password123!" });
    const token = login.body.data.token;

    const changeRes = await request(app)
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "Password123!", newPassword: "NewPassword456!" });
    expect(changeRes.status).toBe(200);

    const oldLogin = await request(app).post("/api/v1/auth/login").send({ email: "owner4@example.com", password: "Password123!" });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post("/api/v1/auth/login").send({ email: "owner4@example.com", password: "NewPassword456!" });
    expect(newLogin.status).toBe(200);
  });

  it("rejects a password change with the wrong current password", async () => {
    await createTestAdmin({ email: "owner5@example.com" });
    const login = await request(app).post("/api/v1/auth/login").send({ email: "owner5@example.com", password: "Password123!" });
    const token = login.body.data.token;

    const res = await request(app)
      .post("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "wrong-one", newPassword: "NewPassword456!" });
    expect(res.status).toBe(401);
  });
});
