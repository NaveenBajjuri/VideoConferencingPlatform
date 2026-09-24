import dotenv from "dotenv";
import type { types as mediasoupTypes } from "mediasoup";

dotenv.config();

const required = (name: string, fallback: string = ""): string => {
    const value = process.env[name] ?? fallback;
    return value;
};

export interface Config {
    env: string;
    port: number;
    mongoUri: string;
    corsOrigins: string[];
    jwt: {
        accessSecret: string;
        refreshSecret: string;
        accessExpiresIn: string;
        refreshExpiresIn: string;
    };
    redis: {
        enabled: boolean;
        url: string;
    };
    turn: {
        url: string;
        username: string;
        credential: string;
    };
    mediasoup: {
        numWorkers: number;
        workerSettings: mediasoupTypes.WorkerSettings;
        listenIp: string;
        announcedIp: string;
    };
    smtp: {
        host: string;
        port: number;
        user: string;
        pass: string;
        from: string;
    };
    logLevel: string;
}

export const config: Config = {
    env: process.env.NODE_ENV || "development",
    port: parseInt(process.env.PORT || "8000", 10),

    mongoUri:
        process.env.MONGO_URI ||
        "mongodb://127.0.0.1:27017/zoom-clone",

    corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:3000")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),

    jwt: {
        accessSecret: required("JWT_ACCESS_SECRET", "dev_access_secret_change_me"),
        refreshSecret: required("JWT_REFRESH_SECRET", "dev_refresh_secret_change_me"),
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    },

    redis: {
        enabled: (process.env.USE_REDIS || "false").toLowerCase() === "true",
        url: process.env.REDIS_URL || "redis://localhost:6379",
    },

    turn: {
        url: process.env.TURN_URL || "",
        username: process.env.TURN_USERNAME || "",
        credential: process.env.TURN_CREDENTIAL || "",
    },

    mediasoup: {
        numWorkers: process.env.MEDIASOUP_NUM_WORKERS
            ? parseInt(process.env.MEDIASOUP_NUM_WORKERS, 10)
            : 0,

        workerSettings: {
            logLevel: (process.env.MEDIASOUP_WORKER_LOG_LEVEL || "warn") as mediasoupTypes.WorkerLogLevel,
            rtcMinPort: parseInt(process.env.MEDIASOUP_MIN_PORT || "40000", 10),
            rtcMaxPort: parseInt(process.env.MEDIASOUP_MAX_PORT || "49999", 10),
        },

        listenIp: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || "127.0.0.1",
    },

    smtp: {
        host: process.env.SMTP_HOST || "",
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
        from: process.env.SMTP_FROM || "Zoom Clone <no-reply@example.com>",
    },

    logLevel: process.env.LOG_LEVEL || "info",
};

export default config;
