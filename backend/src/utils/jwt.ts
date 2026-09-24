import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import config from "../config/config.js";
import type { JwtPayload } from "../types/index.js";

export const signAccessToken = (payload: object): string =>
    jwt.sign(payload, config.jwt.accessSecret as Secret, {
        expiresIn: config.jwt.accessExpiresIn,
    } as SignOptions);

export const signRefreshToken = (payload: object): string =>
    jwt.sign(payload, config.jwt.refreshSecret as Secret, {
        expiresIn: config.jwt.refreshExpiresIn,
    } as SignOptions);

export const verifyAccessToken = (token: string): JwtPayload =>
    jwt.verify(token, config.jwt.accessSecret as Secret) as JwtPayload;

export const verifyRefreshToken = (token: string): JwtPayload =>
    jwt.verify(token, config.jwt.refreshSecret as Secret) as JwtPayload;
