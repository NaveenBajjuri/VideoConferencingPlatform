import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";

import config from "../config/config.js";
import logger from "../utils/logger.js";
import { ChatMessage } from "../models/chatMessage.model.js";
import { initWorkers, getNextWorker } from "../sfu/workerManager.js";
import { SfuRegistry, type SfuRoom } from "../sfu/SfuRoom.js";
import type { Direction, ParticipantInfo, RoomState, TransportParams, WhiteboardAction, Poll } from "../types/index.js";

let connections: Record<string, string[]> = {};
let rooms: Record<string, RoomState> = {};
let participants: Record<string, { room: string; name: string }> = {};
let timeOnline: Record<string, Date> = {};
let whiteboardData: Record<string, WhiteboardAction[]> = {};
let roomPolls: Record<string, Poll[]> = {};

const CHAT_HISTORY_LIMIT = 200;

export const sfuRegistry = new SfuRegistry(getNextWorker);

const getOrCreateRoom = (path: string): RoomState => {
    if (!rooms[path]) {
        rooms[path] = {
            host: null,
            locked: false,
            waitingRoomEnabled: false,
            waiting: [],
        };
    }
    return rooms[path];
};

const roomParticipantList = (path: string): ParticipantInfo[] =>
    (connections[path] || []).map((id) => ({
        socketId: id,
        name: participants[id]?.name || "Guest",
        isHost: rooms[path]?.host === id,
    }));

export const connectToSocket = (server: HttpServer): Server => {
    const io = new Server(server, {
        cors: {
            origin: config.corsOrigins,
            methods: ["GET", "POST"],
            allowedHeaders: ["Content-Type", "Authorization"],
            credentials: true,
        },
    });

    let workersReady = initWorkers().catch((err: Error) => {
        logger.error(`Failed to start mediasoup workers: ${err.message}`);
        throw err;
    });

    if (config.redis.enabled) {
        (async () => {
            try {
                const { createAdapter } = await import("@socket.io/redis-adapter");
                const { createClient } = await import("redis");

                const pubClient = createClient({ url: config.redis.url });
                const subClient = pubClient.duplicate();

                await Promise.all([pubClient.connect(), subClient.connect()]);

                io.adapter(createAdapter(pubClient, subClient));
                logger.info("Socket.IO Redis adapter connected - horizontal scaling enabled");
            } catch (err: any) {
                logger.warn(
                    `Could not enable Redis adapter (falling back to in-memory adapter): ${err.message}`
                );
            }
        })();
    }

    io.on("connection", (socket: Socket) => {
        logger.debug(`Socket connected: ${socket.id}`);

        const completeJoin = async (path: string, socketId: string, name: string) => {
            if (connections[path] === undefined) {
                connections[path] = [];
            }
            if (!connections[path].includes(socketId)) {
                connections[path].push(socketId);
            }
            participants[socketId] = { room: path, name };
            timeOnline[socketId] = new Date();

            const sfuRoom = await sfuRegistry.getOrCreateRoom(path);
            sfuRoom.addPeer(socketId);

            if (!sfuRoom.hasActiveSpeakerListener) {
                sfuRoom.hasActiveSpeakerListener = true;
                sfuRoom.onActiveSpeaker((data) => {
                    (connections[path] || []).forEach((id) => {
                        io.to(id).emit("active-speaker", data);
                    });
                });
            }

            connections[path].forEach((id) =>
                io.to(id).emit("participants-update", roomParticipantList(path))
            );

            connections[path].forEach((id) => {
                if (id !== socketId) io.to(id).emit("peer-joined", socketId);
            });

            try {
                const history = await ChatMessage.find({ room: path })
                    .sort({ createdAt: 1 })
                    .limit(CHAT_HISTORY_LIMIT);

                history.forEach((m) => {
                    io.to(socketId).emit("chat-message", m.data, m.sender, m.socketId);
                });
            } catch (err: any) {
                logger.error(`Failed to load chat history for room ${path}: ${err.message}`);
            }
        };

        socket.on("join-call", async (path: string, displayName?: string) => {
            await workersReady;

            const room = getOrCreateRoom(path);
            const name = (displayName || "Guest").toString().slice(0, 60);

            const isFirstParticipant = !connections[path] || connections[path].length === 0;
            if (isFirstParticipant) {
                room.host = socket.id;
            }

            if (room.waitingRoomEnabled && socket.id !== room.host) {
                room.waiting.push({ socketId: socket.id, name });
                socket.emit("waiting-room");
                if (room.host) {
                    io.to(room.host).emit("waiting-room-update", room.waiting);
                }
                return;
            }

            if (room.locked && socket.id !== room.host) {
                socket.emit("room-locked");
                return;
            }

            await completeJoin(path, socket.id, name);
        });

        const currentSfuRoom = (): { path?: string; sfuRoom?: SfuRoom } => {
            const path = participants[socket.id]?.room;
            if (!path) return { path: undefined, sfuRoom: undefined };
            return { path, sfuRoom: sfuRegistry.getRoom(path) };
        };

        socket.on("get-router-rtp-capabilities", (_data: unknown, ack?: (res: any) => void) => {
            const { sfuRoom } = currentSfuRoom();
            if (!sfuRoom) return ack?.({ error: "Not in a room" });
            ack?.({ rtpCapabilities: sfuRoom.rtpCapabilities });
        });

        socket.on("create-transport", async (data: { direction?: Direction } = {}, ack?: (res: any) => void) => {
            try {
                const { sfuRoom } = currentSfuRoom();
                if (!sfuRoom) throw new Error("Not in a room");
                const { params } = await sfuRoom.createWebRtcTransport(socket.id, data.direction);
                ack?.({ params });
            } catch (err: any) {
                logger.error(`create-transport failed for ${socket.id}: ${err.message}`);
                ack?.({ error: err.message });
            }
        });

        socket.on("connect-transport", async (data: { transportId: string; dtlsParameters: any }, ack?: (res: any) => void) => {
            try {
                const { sfuRoom } = currentSfuRoom();
                if (!sfuRoom) throw new Error("Not in a room");
                await sfuRoom.connectTransport(socket.id, data.transportId, data.dtlsParameters);
                ack?.({ connected: true });
            } catch (err: any) {
                logger.error(`connect-transport failed for ${socket.id}: ${err.message}`);
                ack?.({ error: err.message });
            }
        });

        socket.on("produce", async (data: { transportId: string; kind: any; rtpParameters: any; appData?: any }, ack?: (res: any) => void) => {
            try {
                const { path, sfuRoom } = currentSfuRoom();
                if (!sfuRoom || !path) throw new Error("Not in a room");

                const producer = await sfuRoom.produce(
                    socket.id,
                    data.transportId,
                    data.kind,
                    data.rtpParameters,
                    data.appData
                );

                (connections[path] || []).forEach((id) => {
                    if (id === socket.id) return;
                    io.to(id).emit("new-producer", {
                        producerId: producer.id,
                        socketId: socket.id,
                        kind: producer.kind,
                        appData: producer.appData,
                    });
                });

                ack?.({ id: producer.id });
            } catch (err: any) {
                logger.error(`produce failed for ${socket.id}: ${err.message}`);
                ack?.({ error: err.message });
            }
        });

        socket.on("get-producers", (_data: unknown, ack?: (res: any) => void) => {
            const { sfuRoom } = currentSfuRoom();
            if (!sfuRoom) return ack?.({ producers: [] });
            ack?.({ producers: sfuRoom.getProducersExcept(socket.id) });
        });

        socket.on("consume", async (data: { transportId: string; producerId: string; rtpCapabilities: any }, ack?: (res: any) => void) => {
            try {
                const { sfuRoom } = currentSfuRoom();
                if (!sfuRoom) throw new Error("Not in a room");

                const consumer = await sfuRoom.consume(
                    socket.id,
                    data.transportId,
                    data.producerId,
                    data.rtpCapabilities
                );

                ack?.({
                    params: {
                        id: consumer.id,
                        producerId: data.producerId,
                        kind: consumer.kind,
                        rtpParameters: consumer.rtpParameters,
                        appData: consumer.appData,
                    },
                });
            } catch (err: any) {
                logger.error(`consume failed for ${socket.id}: ${err.message}`);
                ack?.({ error: err.message });
            }
        });

        socket.on("resume-consumer", async (data: { consumerId: string }, ack?: (res: any) => void) => {
            try {
                const { sfuRoom } = currentSfuRoom();
                const consumer = sfuRoom?.getConsumer(socket.id, data.consumerId);
                if (!consumer) throw new Error("Consumer not found");
                await consumer.resume();
                ack?.({ resumed: true });
            } catch (err: any) {
                logger.error(`resume-consumer failed for ${socket.id}: ${err.message}`);
                ack?.({ error: err.message });
            }
        });

        socket.on("set-consumer-preferred-layers", async (data: { consumerId: string; spatialLayer: number; temporalLayer?: number }, ack?: (res: any) => void) => {
            try {
                const { sfuRoom } = currentSfuRoom();
                if (!sfuRoom) throw new Error("Not in a room");
                await sfuRoom.setConsumerPreferredLayers(socket.id, data.consumerId, data.spatialLayer, data.temporalLayer);
                ack?.({ success: true });
            } catch (err: any) {
                logger.debug(`set-consumer-preferred-layers failed for ${socket.id}: ${err.message}`);
                ack?.({ error: err.message });
            }
        });

        socket.on("close-producer", (data: { producerId: string }, ack?: (res: any) => void) => {
            const { path, sfuRoom } = currentSfuRoom();
            const producer = sfuRoom?.closeProducer(socket.id, data.producerId);
            if (producer && path) {
                (connections[path] || []).forEach((id) => {
                    io.to(id).emit("producer-closed", { producerId: data.producerId, socketId: socket.id });
                });
            }
            ack?.({ closed: Boolean(producer) });
        });

        socket.on("chat-message", async (data: string, sender: string) => {
            const path = participants[socket.id]?.room;
            if (!path || !connections[path]?.includes(socket.id)) return;

            connections[path].forEach((elem) => {
                io.to(elem).emit("chat-message", data, sender, socket.id);
            });

            try {
                await ChatMessage.create({ room: path, sender, socketId: socket.id, data });
            } catch (err: any) {
                logger.error(`Failed to persist chat message: ${err.message}`);
            }
        });

        socket.on("mute-all", () => {
            const path = participants[socket.id]?.room;
            if (!path) return;
            const room = rooms[path];
            if (!room || room.host !== socket.id) return;

            (connections[path] || []).forEach((id) => {
                if (id !== socket.id) io.to(id).emit("force-mute");
            });
        });

        socket.on("remove-participant", (targetSocketId: string) => {
            const path = participants[socket.id]?.room;
            if (!path) return;
            const room = rooms[path];
            if (!room || room.host !== socket.id) return;

            io.to(targetSocketId).emit("removed-by-host");
            const targetSocket = io.sockets.sockets.get(targetSocketId);
            if (targetSocket) targetSocket.disconnect(true);
        });

        socket.on("lock-room", () => {
            const path = participants[socket.id]?.room;
            if (!path) return;
            const room = rooms[path];
            if (!room || room.host !== socket.id) return;
            room.locked = true;
            (connections[path] || []).forEach((id) => io.to(id).emit("room-lock-state", true));
        });

        socket.on("unlock-room", () => {
            const path = participants[socket.id]?.room;
            if (!path) return;
            const room = rooms[path];
            if (!room || room.host !== socket.id) return;
            room.locked = false;
            (connections[path] || []).forEach((id) => io.to(id).emit("room-lock-state", false));
        });

        socket.on("enable-waiting-room", (enabled: boolean) => {
            const path = participants[socket.id]?.room;
            if (!path) return;
            const room = rooms[path];
            if (!room || room.host !== socket.id) return;
            room.waitingRoomEnabled = Boolean(enabled);
        });

        socket.on("admit-participant", async (targetSocketId: string) => {
            const path = participants[socket.id]?.room;
            if (!path) return;
            const room = rooms[path];
            if (!room || room.host !== socket.id) return;

            const idx = room.waiting.findIndex((w) => w.socketId === targetSocketId);
            if (idx === -1) return;
            const [waitingUser] = room.waiting.splice(idx, 1);

            io.to(room.host).emit("waiting-room-update", room.waiting);
            io.to(targetSocketId).emit("admitted");
            await completeJoin(path, targetSocketId, waitingUser.name);
        });

        socket.on("deny-participant", (targetSocketId: string) => {
            const path = participants[socket.id]?.room;
            if (!path) return;
            const room = rooms[path];
            if (!room || room.host !== socket.id) return;

            room.waiting = room.waiting.filter((w) => w.socketId !== targetSocketId);
            io.to(room.host).emit("waiting-room-update", room.waiting);
            io.to(targetSocketId).emit("denied");
        });

        socket.on("send-reaction", (emoji: string) => {
            const path = participants[socket.id]?.room;
            if (!path) return;
            const name = participants[socket.id]?.name || "Guest";
            (connections[path] || []).forEach((id) =>
                io.to(id).emit("reaction", { emoji, socketId: socket.id, name })
            );
        });

        socket.on("raise-hand", () => {
            const path = participants[socket.id]?.room;
            if (!path) return;
            (connections[path] || []).forEach((id) =>
                io.to(id).emit("hand-raised", { socketId: socket.id, raised: true })
            );
        });

        socket.on("lower-hand", () => {
            const path = participants[socket.id]?.room;
            if (!path) return;
            (connections[path] || []).forEach((id) =>
                io.to(id).emit("hand-raised", { socketId: socket.id, raised: false })
            );
        });

        socket.on("wb-draw", (action: WhiteboardAction) => {
            const path = participants[socket.id]?.room;
            if (!path) return;
            if (!whiteboardData[path]) whiteboardData[path] = [];
            whiteboardData[path].push(action);
            if (whiteboardData[path].length > 5000) {
                whiteboardData[path] = whiteboardData[path].slice(-3000);
            }
            (connections[path] || []).forEach((id) => {
                if (id !== socket.id) io.to(id).emit("wb-draw", action);
            });
        });

        socket.on("wb-clear", () => {
            const path = participants[socket.id]?.room;
            if (!path) return;
            whiteboardData[path] = [];
            (connections[path] || []).forEach((id) => {
                io.to(id).emit("wb-clear");
            });
        });

        socket.on("wb-get-state", (_data: unknown, ack?: (res: any) => void) => {
            const path = participants[socket.id]?.room;
            if (!path) return ack?.({ actions: [] });
            ack?.({ actions: whiteboardData[path] || [] });
        });

        socket.on("create-poll", (data: { question: string; options: string[] }, ack?: (res: any) => void) => {
            const path = participants[socket.id]?.room;
            if (!path) return ack?.({ error: "Not in a room" });
            const name = participants[socket.id]?.name || "Host";

            const newPoll: Poll = {
                id: `poll-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                question: (data?.question || "").trim().slice(0, 200),
                options: (data?.options || [])
                    .filter((opt) => opt && opt.trim())
                    .map((text, idx) => ({
                        id: idx + 1,
                        text: text.trim().slice(0, 100),
                        votes: 0,
                    })),
                voters: {},
                createdBy: socket.id,
                creatorName: name,
                active: true,
                createdAt: Date.now(),
            };

            if (!newPoll.question) {
                return ack?.({ error: "Question cannot be empty" });
            }

            if (newPoll.options.length < 2) {
                return ack?.({ error: "At least 2 options are required" });
            }

            if (!roomPolls[path]) roomPolls[path] = [];
            roomPolls[path].push(newPoll);

            (connections[path] || []).forEach((id) => {
                io.to(id).emit("new-poll", newPoll);
            });

            ack?.({ poll: newPoll });
        });

        socket.on("vote-poll", (data: { pollId: string; optionId: number }, ack?: (res: any) => void) => {
            const path = participants[socket.id]?.room;
            if (!path || !roomPolls[path]) return ack?.({ error: "Poll not found" });

            const poll = roomPolls[path].find((p) => p.id === data.pollId);
            if (!poll || !poll.active) return ack?.({ error: "Poll is no longer active" });

            const previousVote = poll.voters[socket.id];
            if (previousVote !== undefined) {
                const prevOpt = poll.options.find((o) => o.id === previousVote);
                if (prevOpt && prevOpt.votes > 0) prevOpt.votes--;
            }

            const opt = poll.options.find((o) => o.id === data.optionId);
            if (!opt) return ack?.({ error: "Invalid option" });

            opt.votes++;
            poll.voters[socket.id] = data.optionId;

            (connections[path] || []).forEach((id) => {
                io.to(id).emit("poll-updated", poll);
            });

            ack?.({ success: true, poll });
        });

        socket.on("end-poll", (data: { pollId: string }, ack?: (res: any) => void) => {
            const path = participants[socket.id]?.room;
            if (!path || !roomPolls[path]) return ack?.({ error: "Poll not found" });

            const poll = roomPolls[path].find((p) => p.id === data.pollId);
            if (!poll) return ack?.({ error: "Poll not found" });

            const isHost = rooms[path]?.host === socket.id;
            if (poll.createdBy !== socket.id && !isHost) {
                return ack?.({ error: "Unauthorized" });
            }

            poll.active = false;

            (connections[path] || []).forEach((id) => {
                io.to(id).emit("poll-updated", poll);
            });

            ack?.({ success: true, poll });
        });

        socket.on("get-polls", (_data: unknown, ack?: (res: any) => void) => {
            const path = participants[socket.id]?.room;
            if (!path) return ack?.({ polls: [] });
            ack?.({ polls: roomPolls[path] || [] });
        });

        socket.on("disconnect", () => {
            const path = participants[socket.id]?.room;

            if (path && rooms[path]) {
                rooms[path].waiting = rooms[path].waiting.filter((w) => w.socketId !== socket.id);
            }

            if (path) {
                const sfuRoom = sfuRegistry.getRoom(path);
                if (sfuRoom) {
                    const closedProducerIds = sfuRoom.removePeer(socket.id);
                    (connections[path] || [])
                        .filter((id) => id !== socket.id)
                        .forEach((id) => {
                            closedProducerIds.forEach((producerId) => {
                                io.to(id).emit("producer-closed", { producerId, socketId: socket.id });
                            });
                        });
                }
            }

            for (const [key, ids] of Object.entries(connections)) {
                const idx = ids.indexOf(socket.id);
                if (idx === -1) continue;

                ids.forEach((id) => io.to(id).emit("user-left", socket.id));
                ids.splice(idx, 1);

                if (rooms[key] && rooms[key].host === socket.id) {
                    rooms[key].host = ids[0] || null;
                    if (rooms[key].host) {
                        io.to(rooms[key].host).emit("promoted-to-host");
                    }
                }

                if (ids.length === 0) {
                    delete connections[key];
                    delete rooms[key];
                    delete whiteboardData[key];
                    delete roomPolls[key];
                } else {
                    ids.forEach((id) => io.to(id).emit("participants-update", roomParticipantList(key)));
                }
            }

            if (path) {
                sfuRegistry.closeRoomIfEmpty(path);
            }

            delete participants[socket.id];
            delete timeOnline[socket.id];
        });
    });

    return io;
};

export default connectToSocket;
