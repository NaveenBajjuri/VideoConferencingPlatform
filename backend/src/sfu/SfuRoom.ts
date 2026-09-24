import type { types as mediasoupTypes } from "mediasoup";
import logger from "../utils/logger.js";
import { mediaCodecs, webRtcTransportOptions } from "./mediasoupConfig.js";
import type { Direction, TransportParams, ActiveSpeakerData } from "../types/index.js";

export interface SfuPeerState {
    transports: Map<string, mediasoupTypes.WebRtcTransport>;
    producers: Map<string, mediasoupTypes.Producer>;
    consumers: Map<string, mediasoupTypes.Consumer>;
}

export interface RemoteProducerInfo {
    producerId: string;
    socketId: string;
    kind: mediasoupTypes.MediaKind;
    appData: mediasoupTypes.AppData;
}

export class SfuRoom {
    public router: mediasoupTypes.Router;
    public peers: Map<string, SfuPeerState>;
    public audioLevelObserver?: mediasoupTypes.AudioLevelObserver;
    public hasActiveSpeakerListener: boolean = false;
    private activeSpeakerCallback?: (data: ActiveSpeakerData) => void;

    constructor(router: mediasoupTypes.Router, audioLevelObserver?: mediasoupTypes.AudioLevelObserver) {
        this.router = router;
        this.audioLevelObserver = audioLevelObserver;
        this.peers = new Map<string, SfuPeerState>();

        if (this.audioLevelObserver) {
            this.audioLevelObserver.on("volumes", (volumes) => {
                if (volumes.length > 0) {
                    const { producer, volume } = volumes[0];
                    let speakerSocketId: string | null = null;
                    for (const [socketId, peer] of this.peers.entries()) {
                        if (peer.producers.has(producer.id)) {
                            speakerSocketId = socketId;
                            break;
                        }
                    }
                    if (speakerSocketId && this.activeSpeakerCallback) {
                        this.activeSpeakerCallback({
                            socketId: speakerSocketId,
                            producerId: producer.id,
                            volume,
                        });
                    }
                }
            });

            this.audioLevelObserver.on("silence", () => {
                if (this.activeSpeakerCallback) {
                    this.activeSpeakerCallback({ socketId: null });
                }
            });
        }
    }

    onActiveSpeaker(callback: (data: ActiveSpeakerData) => void): void {
        this.activeSpeakerCallback = callback;
    }

    get rtpCapabilities(): mediasoupTypes.RtpCapabilities {
        return this.router.rtpCapabilities;
    }

    addPeer(socketId: string): SfuPeerState {
        if (!this.peers.has(socketId)) {
            this.peers.set(socketId, {
                transports: new Map(),
                producers: new Map(),
                consumers: new Map(),
            });
        }
        return this.peers.get(socketId)!;
    }

    hasPeer(socketId: string): boolean {
        return this.peers.has(socketId);
    }

    isEmpty(): boolean {
        return this.peers.size === 0;
    }

    async createWebRtcTransport(socketId: string, direction?: Direction): Promise<{
        transport: mediasoupTypes.WebRtcTransport;
        params: TransportParams;
    }> {
        const peer = this.addPeer(socketId);
        const transport = await this.router.createWebRtcTransport(webRtcTransportOptions);

        transport.appData = { socketId, direction };

        transport.on("dtlsstatechange", (dtlsState) => {
            if (dtlsState === "closed" || dtlsState === "failed") {
                transport.close();
            }
        });

        transport.on("@close", () => {
            peer.transports.delete(transport.id);
        });

        peer.transports.set(transport.id, transport);

        return {
            transport,
            params: {
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters,
            },
        };
    }

    getTransport(socketId: string, transportId: string): mediasoupTypes.WebRtcTransport | undefined {
        return this.peers.get(socketId)?.transports.get(transportId);
    }

    async connectTransport(
        socketId: string,
        transportId: string,
        dtlsParameters: mediasoupTypes.DtlsParameters
    ): Promise<void> {
        const transport = this.getTransport(socketId, transportId);
        if (!transport) throw new Error(`Transport ${transportId} not found for peer ${socketId}`);
        await transport.connect({ dtlsParameters });
    }

    async produce(
        socketId: string,
        transportId: string,
        kind: mediasoupTypes.MediaKind,
        rtpParameters: mediasoupTypes.RtpParameters,
        appData?: mediasoupTypes.AppData
    ): Promise<mediasoupTypes.Producer> {
        const peer = this.addPeer(socketId);
        const transport = this.getTransport(socketId, transportId);
        if (!transport) throw new Error(`Transport ${transportId} not found for peer ${socketId}`);

        const producer = await transport.produce({ kind, rtpParameters, appData });

        if (kind === "audio" && this.audioLevelObserver) {
            this.audioLevelObserver.addProducer({ producerId: producer.id }).catch((err: any) => {
                logger.debug(`Failed to register producer ${producer.id} with audioLevelObserver: ${err.message}`);
            });
        }

        producer.on("transportclose", () => {
            peer.producers.delete(producer.id);
        });

        peer.producers.set(producer.id, producer);
        return producer;
    }

    async consume(
        socketId: string,
        transportId: string,
        producerId: string,
        rtpCapabilities: mediasoupTypes.RtpCapabilities
    ): Promise<mediasoupTypes.Consumer> {
        if (!this.router.canConsume({ producerId, rtpCapabilities })) {
            throw new Error("Cannot consume this producer with the given rtpCapabilities");
        }

        const peer = this.addPeer(socketId);
        const transport = this.getTransport(socketId, transportId);
        if (!transport) throw new Error(`Transport ${transportId} not found for peer ${socketId}`);

        const consumer = await transport.consume({
            producerId,
            rtpCapabilities,
            paused: true,
        });

        consumer.on("transportclose", () => {
            peer.consumers.delete(consumer.id);
        });
        consumer.on("producerclose", () => {
            peer.consumers.delete(consumer.id);
        });

        peer.consumers.set(consumer.id, consumer);
        return consumer;
    }

    getConsumer(socketId: string, consumerId: string): mediasoupTypes.Consumer | undefined {
        return this.peers.get(socketId)?.consumers.get(consumerId);
    }

    async setConsumerPreferredLayers(
        socketId: string,
        consumerId: string,
        spatialLayer: number,
        temporalLayer?: number
    ): Promise<void> {
        const consumer = this.getConsumer(socketId, consumerId);
        if (!consumer) throw new Error(`Consumer ${consumerId} not found`);
        await consumer.setPreferredLayers({ spatialLayer, temporalLayer });
    }

    getProducer(socketId: string, producerId: string): mediasoupTypes.Producer | undefined {
        return this.peers.get(socketId)?.producers.get(producerId);
    }

    getProducersExcept(socketId: string): RemoteProducerInfo[] {
        const list: RemoteProducerInfo[] = [];
        for (const [peerSocketId, peer] of this.peers.entries()) {
            if (peerSocketId === socketId) continue;
            for (const producer of peer.producers.values()) {
                list.push({
                    producerId: producer.id,
                    socketId: peerSocketId,
                    kind: producer.kind,
                    appData: producer.appData,
                });
            }
        }
        return list;
    }

    closeProducer(socketId: string, producerId: string): mediasoupTypes.Producer | undefined {
        const producer = this.getProducer(socketId, producerId);
        if (!producer) return undefined;
        producer.close();
        this.peers.get(socketId)?.producers.delete(producerId);
        return producer;
    }

    removePeer(socketId: string): string[] {
        const peer = this.peers.get(socketId);
        if (!peer) return [];

        const closedProducerIds = Array.from(peer.producers.keys());
        for (const transport of peer.transports.values()) {
            transport.close();
        }

        this.peers.delete(socketId);
        return closedProducerIds;
    }

    close(): void {
        for (const socketId of Array.from(this.peers.keys())) {
            this.removePeer(socketId);
        }
        if (this.audioLevelObserver && !this.audioLevelObserver.closed) {
            this.audioLevelObserver.close();
        }
        this.router.close();
    }
}

export class SfuRegistry {
    private getWorker: () => mediasoupTypes.Worker;
    public rooms: Map<string, SfuRoom>;

    constructor(getWorker: () => mediasoupTypes.Worker) {
        this.getWorker = getWorker;
        this.rooms = new Map();
    }

    async getOrCreateRoom(path: string): Promise<SfuRoom> {
        let room = this.rooms.get(path);
        if (room) return room;

        const worker = this.getWorker();
        const router = await worker.createRouter({ mediaCodecs });
        let audioLevelObserver: mediasoupTypes.AudioLevelObserver | undefined;
        try {
            audioLevelObserver = await router.createAudioLevelObserver({
                maxEntries: 1,
                threshold: -80,
                interval: 300,
            });
        } catch (err: any) {
            logger.warn(`Failed to create audioLevelObserver for room "${path}": ${err.message}`);
        }
        room = new SfuRoom(router, audioLevelObserver);
        this.rooms.set(path, room);
        logger.debug(`Created mediasoup router and audioLevelObserver for room "${path}" on worker ${worker.pid}`);
        return room;
    }

    getRoom(path: string): SfuRoom | undefined {
        return this.rooms.get(path);
    }

    closeRoomIfEmpty(path: string): void {
        const room = this.rooms.get(path);
        if (room && room.isEmpty()) {
            room.close();
            this.rooms.delete(path);
            logger.debug(`Closed empty mediasoup router for room "${path}"`);
        }
    }
}
