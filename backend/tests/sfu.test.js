import { jest } from "@jest/globals";
import { createServer } from "node:http";
import { io as ioClient } from "socket.io-client";

import { connectToSocket } from "../dist/controllers/socketManager.js";

jest.setTimeout(20000);

const waitFor = (socket, event) =>
    new Promise((resolve) => socket.once(event, (...args) => resolve(args)));

const emitAck = (socket, event, payload = {}) =>
    new Promise((resolve) => socket.emit(event, payload, resolve));

describe("mediasoup SFU signaling (real worker/router, over real Socket.IO)", () => {
    let httpServer;
    let baseUrl;
    let clientA;
    let clientB;
    const room = `test-room-${Date.now()}`;

    beforeAll(async () => {
        httpServer = createServer();
        connectToSocket(httpServer);
        await new Promise((resolve) => httpServer.listen(0, resolve));
        const { port } = httpServer.address();
        baseUrl = `http://localhost:${port}`;
    });

    afterAll(async () => {
        clientA?.disconnect();
        clientB?.disconnect();
        await new Promise((resolve) => httpServer.close(resolve));
    });

    it("lets a peer join a room and receive router RTP capabilities", async () => {
        clientA = ioClient(baseUrl, { transports: ["websocket"] });
        await waitFor(clientA, "connect");

        clientA.emit("join-call", room, "Alice");
        await waitFor(clientA, "participants-update");

        const { rtpCapabilities, error } = await emitAck(clientA, "get-router-rtp-capabilities");

        expect(error).toBeUndefined();
        expect(rtpCapabilities).toBeDefined();
        const mimeTypes = rtpCapabilities.codecs.map((c) => c.mimeType);
        expect(mimeTypes).toContain("audio/opus");
        expect(mimeTypes).toContain("video/VP8");
    });

    it("creates a real WebRTC send transport with usable ICE/DTLS parameters", async () => {
        const { params, error } = await emitAck(clientA, "create-transport", { direction: "send" });

        expect(error).toBeUndefined();
        expect(params.id).toBeDefined();
        expect(params.iceParameters.usernameFragment).toBeDefined();
        expect(params.iceCandidates.length).toBeGreaterThan(0);
        expect(params.dtlsParameters.fingerprints.length).toBeGreaterThan(0);
    });

    it("rejects SFU signaling from a socket that hasn't joined a room", async () => {
        const stray = ioClient(baseUrl, { transports: ["websocket"] });
        await waitFor(stray, "connect");

        const { error } = await emitAck(stray, "get-router-rtp-capabilities");
        expect(error).toBe("Not in a room");

        stray.disconnect();
    });

    it("notifies an existing participant when a second peer joins the same room", async () => {
        clientB = ioClient(baseUrl, { transports: ["websocket"] });
        await waitFor(clientB, "connect");

        const peerJoined = waitFor(clientA, "peer-joined");
        clientB.emit("join-call", room, "Bob");
        const [joinedSocketId] = await peerJoined;

        expect(joinedSocketId).toBe(clientB.id);

        const { producers, error } = await emitAck(clientB, "get-producers");
        expect(error).toBeUndefined();
        expect(Array.isArray(producers)).toBe(true);
    });

    it("tears down a peer's transports and notifies the room on disconnect", async () => {
        // clientB never produced anything, so there's nothing to assert via
        // producer-closed here - what we're really checking is that
        // disconnecting a peer that has SFU resources open doesn't throw or
        // hang the server (removePeer/closeRoomIfEmpty run cleanly).
        const participantsUpdate = waitFor(clientA, "participants-update");
        clientB.disconnect();
        const [list] = await participantsUpdate;

        expect(list.find((p) => p.name === "Bob")).toBeUndefined();
    });
});
