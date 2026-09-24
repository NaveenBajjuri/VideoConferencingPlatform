import express, { type Request, type Response, type NextFunction } from "express";
import { createServer, type Server as HttpServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import helmet from "helmet";
import mongoose from "mongoose";
import cors from "cors";
import type { Server as SocketIoServer } from "socket.io";

import config from "./config/config.js";
import logger from "./utils/logger.js";
import { connectToSocket } from "./controllers/socketManager.js";
import userRoutes from "./routes/users.routes.js";
import meetingRoutes from "./routes/meetings.routes.js";

const app = express();
const server: HttpServer = createServer(app);
const io: SocketIoServer = connectToSocket(server);

app.set("port", config.port);

app.use(helmet());

app.use(
    cors({
        origin: config.corsOrigins,
        credentials: true,
    })
);

app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/meetings", meetingRoutes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(`Unhandled error: ${err.stack || err.message}`);
    res.status(err.status || 500).json({ message: "Internal server error" });
});

const start = async () => {
    if (
        config.env === "production" &&
        (config.jwt.accessSecret === "dev_access_secret_change_me" ||
            config.jwt.refreshSecret === "dev_refresh_secret_change_me")
    ) {
        logger.warn(
            "JWT secrets are using insecure development defaults in production! Set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET."
        );
    }

    try {
        const connectionDb = await mongoose.connect(config.mongoUri);
        logger.info(`MongoDB connected: ${connectionDb.connection.host}`);
    } catch (err: any) {
        logger.error(`MongoDB connection failed: ${err.message}`);
        process.exit(1);
    }

    server.listen(app.get("port"), () => {
        logger.info(`Server listening on port ${app.get("port")} (${config.env})`);
    });
};

const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close(() => logger.info("HTTP server closed"));
    await mongoose.connection.close();
    process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

const isMainModule =
    process.argv[1] &&
    (fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
        import.meta.url === `file://${process.argv[1]}`);
if (isMainModule) {
    start();
}

export { app, server, io, start };
export default app;
