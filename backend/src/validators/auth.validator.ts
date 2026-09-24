import type { Request, Response, NextFunction } from "express";
import { body, query, validationResult } from "express-validator";
import httpStatus from "http-status";

export const handleValidation = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(httpStatus.BAD_REQUEST).json({
            message: "Validation failed",
            errors: errors.array().map((e: any) => ({ field: e.path, message: e.msg })),
        });
    }
    next();
};

export const registerValidation = [
    body("name")
        .trim()
        .isLength({ min: 2, max: 60 })
        .withMessage("Name must be between 2 and 60 characters"),
    body("username")
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage("Username must be between 3 and 30 characters")
        .matches(/^[a-zA-Z0-9_.-]+$/)
        .withMessage("Username can only contain letters, numbers, dots, dashes and underscores"),
    body("password")
        .isLength({ min: 6, max: 72 })
        .withMessage("Password must be at least 6 characters long"),
    handleValidation,
];

export const loginValidation = [
    body("username").trim().notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
    handleValidation,
];

export const refreshValidation = [
    body("refreshToken").notEmpty().withMessage("refreshToken is required"),
    handleValidation,
];

export const addToHistoryValidation = [
    body("meeting_code").trim().notEmpty().withMessage("meeting_code is required"),
    handleValidation,
];

export const historyQueryValidation = [
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt(),
    query("search").optional().trim(),
    handleValidation,
];
