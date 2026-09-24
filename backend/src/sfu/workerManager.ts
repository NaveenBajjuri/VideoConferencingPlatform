import os from "node:os";
import * as mediasoup from "mediasoup";
import type { types as mediasoupTypes } from "mediasoup";
import config from "../config/config.js";
import logger from "../utils/logger.js";

let workers: mediasoupTypes.Worker[] = [];
let nextWorkerIndex = 0;

export const initWorkers = async (): Promise<mediasoupTypes.Worker[]> => {
    const numWorkers = config.mediasoup.numWorkers > 0 ? config.mediasoup.numWorkers : os.cpus().length;

    logger.info(`Starting ${numWorkers} mediasoup worker(s)...`);

    for (let i = 0; i < numWorkers; i++) {
        const worker = await mediasoup.createWorker(config.mediasoup.workerSettings);

        worker.on("died", (err: Error) => {
            logger.error(
                `mediasoup worker ${worker.pid} died unexpectedly: ${err.message}. Exiting process.`
            );
            setTimeout(() => process.exit(1), 2000);
        });

        workers.push(worker);
    }

    logger.info(`${workers.length} mediasoup worker(s) ready.`);
    return workers;
};

export const getNextWorker = (): mediasoupTypes.Worker => {
    if (workers.length === 0) {
        throw new Error("mediasoup workers have not been initialized yet (call initWorkers() at startup)");
    }
    const worker = workers[nextWorkerIndex];
    nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
    return worker;
};

export const getWorkers = (): mediasoupTypes.Worker[] => workers;

export const _resetForTests = async (): Promise<void> => {
    await Promise.all(workers.map((w) => w.close()));
    workers = [];
    nextWorkerIndex = 0;
};
