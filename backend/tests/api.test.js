import request from "supertest";
import { app } from "../dist/app.js";

describe("GET /health", () => {
    it("returns 200 and status ok", async () => {
        const res = await request(app).get("/health");
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");
    });
});

describe("POST /api/v1/users/register validation", () => {
    it("rejects a missing username/password with 400", async () => {
        const res = await request(app).post("/api/v1/users/register").send({ name: "Test" });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe("Validation failed");
    });

    it("rejects a short password with 400", async () => {
        const res = await request(app)
            .post("/api/v1/users/register")
            .send({ name: "Test User", username: "testuser1", password: "123" });
        expect(res.status).toBe(400);
    });

    it("rejects an invalid username format with 400", async () => {
        const res = await request(app)
            .post("/api/v1/users/register")
            .send({ name: "Test User", username: "bad username!", password: "password123" });
        expect(res.status).toBe(400);
    });
});

describe("POST /api/v1/users/login validation", () => {
    it("rejects an empty body with 400", async () => {
        const res = await request(app).post("/api/v1/users/login").send({});
        expect(res.status).toBe(400);
    });
});

describe("Protected routes without a token", () => {
    it("GET /api/v1/users/get_all_activity returns 401 without a token", async () => {
        const res = await request(app).get("/api/v1/users/get_all_activity");
        expect(res.status).toBe(401);
    });

    it("POST /api/v1/users/add_to_activity returns 401 without a token", async () => {
        const res = await request(app)
            .post("/api/v1/users/add_to_activity")
            .send({ meeting_code: "abc123" });
        expect(res.status).toBe(401);
    });
});
