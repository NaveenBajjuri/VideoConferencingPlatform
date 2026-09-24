import { Device, type types as mediasoupClientTypes } from "mediasoup-client";

export interface RemoteProducerAnnouncement {
    producerId: string;
    socketId: string;
    kind: mediasoupClientTypes.MediaKind;
    appData?: any;
}

export interface ConsumedStreamInfo {
    consumer: mediasoupClientTypes.Consumer;
    track: MediaStreamTrack;
    socketId: string;
    kind: mediasoupClientTypes.MediaKind;
    appData?: any;
}

export interface ClosedConsumerInfo {
    appData?: any;
    kind: mediasoupClientTypes.MediaKind;
}

export default class SfuClient {
    public socket: any;
    public iceServers: any[];
    public device: Device | null;
    public sendTransport: mediasoupClientTypes.Transport | null;
    public recvTransport: mediasoupClientTypes.Transport | null;
    public producers: Map<string, mediasoupClientTypes.Producer>;
    public consumersById: Map<string, mediasoupClientTypes.Consumer>;
    public consumersByProducerId: Map<string, mediasoupClientTypes.Consumer>;

    constructor(socket: any, iceServers: any[] = []) {
        this.socket = socket;
        this.iceServers = iceServers;
        this.device = null;
        this.sendTransport = null;
        this.recvTransport = null;

        this.producers = new Map();
        this.consumersById = new Map();
        this.consumersByProducerId = new Map();
    }

    _request<T = any>(event: string, payload: any = {}): Promise<T> {
        return new Promise((resolve, reject) => {
            this.socket.emit(event, payload, (response: any) => {
                if (response && response.error) {
                    reject(new Error(`${event} failed: ${response.error}`));
                } else {
                    resolve(response);
                }
            });
        });
    }

    async load(): Promise<Device> {
        const { rtpCapabilities, error } = await this._request("get-router-rtp-capabilities");
        if (error) throw new Error(error);

        this.device = new Device();
        await this.device.load({ routerRtpCapabilities: rtpCapabilities });
        return this.device;
    }

    async _createTransport(direction: "send" | "recv"): Promise<mediasoupClientTypes.Transport> {
        if (!this.device) throw new Error("Device not initialized");
        const { params } = await this._request("create-transport", { direction });

        const method = direction === "send" ? "createSendTransport" : "createRecvTransport";
        const transport = this.device[method]({
            id: params.id,
            iceParameters: params.iceParameters,
            iceCandidates: params.iceCandidates,
            dtlsParameters: params.dtlsParameters,
            iceServers: this.iceServers,
        });

        transport.on("connect", ({ dtlsParameters }, callback, errback) => {
            this._request("connect-transport", { transportId: transport.id, dtlsParameters })
                .then(callback)
                .catch(errback);
        });

        if (direction === "send") {
            transport.on("produce", ({ kind, rtpParameters, appData }, callback, errback) => {
                this._request("produce", { transportId: transport.id, kind, rtpParameters, appData })
                    .then(({ id }) => callback({ id }))
                    .catch(errback);
            });
        }

        transport.on("connectionstatechange", (state) => {
            if (state === "failed" || state === "disconnected") {
                // eslint-disable-next-line no-console
                console.warn(`mediasoup ${direction} transport ${state}`);
            }
        });

        return transport;
    }

    async ensureSendTransport(): Promise<mediasoupClientTypes.Transport> {
        if (!this.sendTransport || this.sendTransport.closed) {
            this.sendTransport = await this._createTransport("send");
        }
        return this.sendTransport;
    }

    async ensureRecvTransport(): Promise<mediasoupClientTypes.Transport> {
        if (!this.recvTransport || this.recvTransport.closed) {
            this.recvTransport = await this._createTransport("recv");
        }
        return this.recvTransport;
    }

    async produce(name: string, track: MediaStreamTrack | null, extraAppData: any = {}): Promise<mediasoupClientTypes.Producer | null> {
        if (!track) return null;
        await this.ensureSendTransport();
        if (!this.sendTransport) throw new Error("Send transport not available");

        const existing = this.producers.get(name);
        if (existing && !existing.closed) {
            await existing.replaceTrack({ track });
            return existing;
        }

        let encodings: any[] | undefined = undefined;
        if (track.kind === "video") {
            if (name === "screen") {
                encodings = [{ maxBitrate: 2500000 }];
            } else {
                // 3-layer simulcast for webcam (low, medium, high)
                encodings = [
                    { rid: "r0", maxBitrate: 100000, scaleResolutionDownBy: 4 },
                    { rid: "r1", maxBitrate: 300000, scaleResolutionDownBy: 2 },
                    { rid: "r2", maxBitrate: 900000, scaleResolutionDownBy: 1 },
                ];
            }
        }

        const producer = await this.sendTransport.produce({
            track,
            appData: { source: name, ...extraAppData },
            ...(encodings ? { encodings } : {}),
        });

        producer.on("transportclose", () => this.producers.delete(name));
        producer.on("trackended", () => this.closeProducer(name).catch(() => {}));

        this.producers.set(name, producer);
        return producer;
    }

    async setPreferredLayers(consumerId: string, spatialLayer: number, temporalLayer: number = 2): Promise<void> {
        try {
            await this._request("set-consumer-preferred-layers", { consumerId, spatialLayer, temporalLayer });
        } catch (e) {
            // Ignore if not supported
        }
    }

    async setPreferredLayersBySocketId(socketId: string, spatialLayer: number, temporalLayer: number = 2): Promise<void> {
        for (const consumer of this.consumersById.values()) {
            if (consumer.appData?.socketId === socketId && consumer.kind === "video") {
                await this.setPreferredLayers(consumer.id, spatialLayer, temporalLayer);
            }
        }
    }

    async getNetworkStats(): Promise<{ rtt: number; packetLoss: number; bitrate: number; quality: "good" | "fair" | "poor" }> {
        if (!this.sendTransport && this.consumersById.size === 0) {
            return { rtt: 0, packetLoss: 0, bitrate: 0, quality: "good" };
        }
        let totalRtt = 0;
        let rttCount = 0;
        let packetsLost = 0;
        let packetsReceived = 0;
        let bytesReceived = 0;

        if (this.sendTransport) {
            try {
                const stats = await this.sendTransport.getStats();
                stats.forEach((report: any) => {
                    if (report.type === "candidate-pair" && report.state === "succeeded" && typeof report.currentRoundTripTime === "number") {
                        totalRtt += report.currentRoundTripTime * 1000;
                        rttCount++;
                    }
                });
            } catch (e) {}
        }

        for (const consumer of this.consumersById.values()) {
            try {
                const stats = await consumer.getStats();
                for (const report of Array.from(stats.values()) as any[]) {
                    if (report.type === "inbound-rtp") {
                        if (typeof report.packetsLost === "number") packetsLost += report.packetsLost;
                        if (typeof report.packetsReceived === "number") packetsReceived += report.packetsReceived;
                        if (typeof report.bytesReceived === "number") bytesReceived += report.bytesReceived;
                    }
                }
            } catch (e) {}
        }

        const rtt = rttCount > 0 ? Math.round(totalRtt / rttCount) : 45;
        const totalPackets = packetsLost + packetsReceived;
        const lossPct = totalPackets > 0 ? Math.round((packetsLost / totalPackets) * 100) : 0;

        let quality: "good" | "fair" | "poor" = "good";
        if (lossPct > 8 || rtt > 350) {
            quality = "poor";
        } else if (lossPct > 3 || rtt > 180) {
            quality = "fair";
        }

        return { rtt, packetLoss: lossPct, bitrate: bytesReceived, quality };
    }

    async replaceTrack(name: string, track: MediaStreamTrack): Promise<mediasoupClientTypes.Producer | null> {
        const producer = this.producers.get(name);
        if (!producer || producer.closed) return this.produce(name, track);
        await producer.replaceTrack({ track });
        return producer;
    }

    async closeProducer(name: string): Promise<void> {
        const producer = this.producers.get(name);
        if (!producer || producer.closed) return;
        const producerId = producer.id;
        producer.close();
        this.producers.delete(name);
        try {
            await this._request("close-producer", { producerId });
        } catch (e) {
            // Ignored
        }
    }

    getProducer(name: string): mediasoupClientTypes.Producer | undefined {
        return this.producers.get(name);
    }

    isConsuming(producerId: string): boolean {
        return this.consumersByProducerId.has(producerId);
    }

    async getExistingProducers(): Promise<RemoteProducerAnnouncement[]> {
        const { producers } = await this._request("get-producers");
        return producers || [];
    }

    async consume({ producerId, socketId, kind, appData }: RemoteProducerAnnouncement): Promise<ConsumedStreamInfo | null> {
        if (!this.device) return null;
        await this.ensureRecvTransport();
        if (!this.recvTransport) throw new Error("Recv transport not available");

        const { params, error } = await this._request("consume", {
            transportId: this.recvTransport.id,
            producerId,
            rtpCapabilities: this.device.rtpCapabilities,
        });
        if (error) throw new Error(error);

        const consumer = await this.recvTransport.consume({
            id: params.id,
            producerId: params.producerId,
            kind: params.kind,
            rtpParameters: params.rtpParameters,
            appData: params.appData,
        });

        this.consumersById.set(consumer.id, consumer);
        this.consumersByProducerId.set(producerId, consumer);

        consumer.on("transportclose", () => this._forgetConsumer(consumer));

        await this._request("resume-consumer", { consumerId: consumer.id });

        return {
            consumer,
            track: consumer.track,
            socketId,
            kind: kind || params.kind,
            appData: appData || params.appData,
        };
    }

    _forgetConsumer(consumer: mediasoupClientTypes.Consumer): void {
        this.consumersById.delete(consumer.id);
        for (const [producerId, c] of this.consumersByProducerId.entries()) {
            if (c === consumer) this.consumersByProducerId.delete(producerId);
        }
    }

    closeConsumerByProducerId(producerId: string): ClosedConsumerInfo | null {
        const consumer = this.consumersByProducerId.get(producerId);
        if (!consumer) return null;
        const info: ClosedConsumerInfo = { appData: consumer.appData, kind: consumer.kind };
        consumer.close();
        this._forgetConsumer(consumer);
        return info;
    }

    close(): void {
        for (const producer of this.producers.values()) {
            try {
                producer.close();
            } catch (e) {}
        }
        this.producers.clear();

        for (const consumer of this.consumersById.values()) {
            try {
                consumer.close();
            } catch (e) {}
        }
        this.consumersById.clear();
        this.consumersByProducerId.clear();

        try {
            this.sendTransport?.close();
        } catch (e) {}
        try {
            this.recvTransport?.close();
        } catch (e) {}
    }
}
