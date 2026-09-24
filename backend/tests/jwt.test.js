import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "../dist/utils/jwt.js";

describe("jwt utils", () => {
    const payload = { id: "abc123", username: "tester" };

    it("signs and verifies an access token", () => {
        const token = signAccessToken(payload);
        const decoded = verifyAccessToken(token);
        expect(decoded.id).toBe(payload.id);
        expect(decoded.username).toBe(payload.username);
    });

    it("signs and verifies a refresh token", () => {
        const token = signRefreshToken(payload);
        const decoded = verifyRefreshToken(token);
        expect(decoded.id).toBe(payload.id);
    });

    it("rejects a tampered token", () => {
        const token = signAccessToken(payload);
        const tampered = token.slice(0, -2) + "xx";
        expect(() => verifyAccessToken(tampered)).toThrow();
    });

    it("does not verify an access token as a refresh token (different secrets)", () => {
        const token = signAccessToken(payload);
        expect(() => verifyRefreshToken(token)).toThrow();
    });
});
