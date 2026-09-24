import type { Response, NextFunction } from "express";
import httpStatus from "http-status";
import { verifyAccessToken } from "../utils/jwt.js";
import logger from "../utils/logger.js";
import type { AuthRequest } from "../types/index.js";

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = (req.headers["authorization"] as string) || "";
        const bearerToken = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : null;

        const token = bearerToken || (req.query.token as string) || req.body?.token;

        if (!token) {
            return res
                .status(httpStatus.UNAUTHORIZED)
                .json({ message: "Authentication token is required" });
        }

        const decoded = verifyAccessToken(token);
        req.user = {
            id: decoded.id || decoded.userId,
            username: decoded.username,
        };
        return next();
    } catch (err: any) {
        logger.warn(`Auth middleware rejected request: ${err.message}`);
        return res
            .status(httpStatus.UNAUTHORIZED)
            .json({ message: "Invalid or expired token" });
    }
};

export default requireAuth;
