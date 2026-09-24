import type { Request, Response } from "express";
import httpStatus from "http-status";
import bcrypt from "bcrypt";
import crypto from "crypto";

import { User, type UserDocument } from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import logger from "../utils/logger.js";
import type { AuthRequest } from "../types/index.js";

const hashToken = (token: string): string => crypto.createHash("sha256").update(token).digest("hex");

const issueTokens = async (user: UserDocument) => {
    const payload = { id: user._id.toString(), username: user.username };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    user.refreshToken = hashToken(refreshToken);
    user.token = accessToken;
    await user.save();

    return { accessToken, refreshToken };
};

export const login = async (req: Request, res: Response) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User Not Found" });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);

        if (!isPasswordCorrect) {
            return res
                .status(httpStatus.UNAUTHORIZED)
                .json({ message: "Invalid Username or password" });
        }

        const { accessToken, refreshToken } = await issueTokens(user);

        return res.status(httpStatus.OK).json({
            token: accessToken,
            accessToken,
            refreshToken,
            user: { name: user.name, username: user.username },
        });
    } catch (e: any) {
        logger.error(`Login failed: ${e.message}`);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Something went wrong while logging in" });
    }
};

export const register = async (req: Request, res: Response) => {
    const { name, username, password } = req.body;

    try {
        const existingUser = await User.findOne({ username: username.toLowerCase() });
        if (existingUser) {
            return res.status(httpStatus.CONFLICT).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            username: username.toLowerCase(),
            password: hashedPassword,
        });

        await newUser.save();

        return res.status(httpStatus.CREATED).json({ message: "User Registered" });
    } catch (e: any) {
        logger.error(`Register failed: ${e.message}`);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Something went wrong while registering" });
    }
};

export const refreshTokenHandler = async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    try {
        const decoded = verifyRefreshToken(refreshToken);
        const user = await User.findById(decoded.id || decoded.userId);

        if (!user || user.refreshToken !== hashToken(refreshToken)) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid refresh token" });
        }

        const tokens = await issueTokens(user);
        return res.status(httpStatus.OK).json(tokens);
    } catch (e) {
        return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid or expired refresh token" });
    }
};

export const logout = async (req: AuthRequest, res: Response) => {
    try {
        if (req.user?.id) {
            await User.findByIdAndUpdate(req.user.id, { $unset: { refreshToken: 1, token: 1 } });
        }
        return res.status(httpStatus.OK).json({ message: "Logged out" });
    } catch (e: any) {
        logger.error(`Logout failed: ${e.message}`);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Something went wrong" });
    }
};

export const getUserHistory = async (req: AuthRequest, res: Response) => {
    try {
        const username = req.user?.username;

        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 10;
        const search = ((req.query.search as string) || "").trim();

        const filter: any = { user_id: username };
        if (search) {
            filter.meetingCode = { $regex: search, $options: "i" };
        }

        const [meetings, total] = await Promise.all([
            Meeting.find(filter)
                .sort({ date: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Meeting.countDocuments(filter),
        ]);

        return res.json({
            meetings,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(Math.ceil(total / limit), 1),
            },
        });
    } catch (e: any) {
        logger.error(`getUserHistory failed: ${e.message}`);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Something went wrong fetching history" });
    }
};

export const addToHistory = async (req: AuthRequest, res: Response) => {
    const { meeting_code } = req.body;

    try {
        const username = req.user?.username;

        const newMeeting = new Meeting({
            user_id: username,
            meetingCode: meeting_code,
        });

        await newMeeting.save();

        return res.status(httpStatus.CREATED).json({ message: "Added code to history" });
    } catch (e: any) {
        logger.error(`addToHistory failed: ${e.message}`);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Something went wrong saving history" });
    }
};

export default { login, register, refreshTokenHandler, logout, getUserHistory, addToHistory };
