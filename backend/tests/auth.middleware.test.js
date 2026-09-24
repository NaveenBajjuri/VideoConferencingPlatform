import { jest } from "@jest/globals";
import { requireAuth } from "../dist/middleware/auth.middleware.js";
import { signAccessToken } from "../dist/utils/jwt.js";

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe("requireAuth middleware", () => {
    it("calls next() and attaches req.user for a valid bearer token", () => {
        const token = signAccessToken({ id: "1", username: "tester" });
        const req = { headers: { authorization: `Bearer ${token}` }, query: {}, body: {} };
        const res = mockRes();
        const next = jest.fn();

        requireAuth(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toEqual({ id: "1", username: "tester" });
    });

    it("returns 401 when no token is provided", () => {
        const req = { headers: {}, query: {}, body: {} };
        const res = mockRes();
        const next = jest.fn();

        requireAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 for an invalid token", () => {
        const req = { headers: { authorization: "Bearer not-a-real-token" }, query: {}, body: {} };
        const res = mockRes();
        const next = jest.fn();

        requireAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    it("accepts a token passed as a query param (legacy compatibility)", () => {
        const token = signAccessToken({ id: "2", username: "legacy" });
        const req = { headers: {}, query: { token }, body: {} };
        const res = mockRes();
        const next = jest.fn();

        requireAuth(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user.username).toBe("legacy");
    });
});
