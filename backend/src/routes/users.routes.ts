import { Router, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";

import {
    addToHistory,
    getUserHistory,
    login,
    logout,
    refreshTokenHandler,
    register,
} from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
    addToHistoryValidation,
    historyQueryValidation,
    loginValidation,
    refreshValidation,
    registerValidation,
} from "../validators/auth.validator.js";

const router = Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many attempts, please try again later." },
});

router.route("/login").post(authLimiter, ...(loginValidation as RequestHandler[]), login as RequestHandler);
router.route("/register").post(authLimiter, ...(registerValidation as RequestHandler[]), register as RequestHandler);
router.route("/refresh-token").post(authLimiter, ...(refreshValidation as RequestHandler[]), refreshTokenHandler as RequestHandler);
router.route("/logout").post(requireAuth as RequestHandler, logout as RequestHandler);

router.route("/add_to_activity").post(requireAuth as RequestHandler, ...(addToHistoryValidation as RequestHandler[]), addToHistory as RequestHandler);
router.route("/get_all_activity").get(requireAuth as RequestHandler, ...(historyQueryValidation as RequestHandler[]), getUserHistory as RequestHandler);

export default router;
