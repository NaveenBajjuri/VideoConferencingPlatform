import winston from "winston";
import config from "../config/config.js";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, stack }) => {
    return `${ts} [${level}]: ${stack || message}`;
});

export const logger = winston.createLogger({
    level: config.logLevel,
    format: combine(errors({ stack: true }), timestamp(), logFormat),
    transports: [
        new winston.transports.Console({
            format: combine(colorize(), errors({ stack: true }), timestamp(), logFormat),
        }),
        new winston.transports.File({ filename: "logs/error.log", level: "error" }),
        new winston.transports.File({ filename: "logs/combined.log" }),
    ],
    exitOnError: false,
});

logger.on("error", (err: Error) => {
    // eslint-disable-next-line no-console
    console.error("Logger transport error:", err.message);
});

export default logger;
