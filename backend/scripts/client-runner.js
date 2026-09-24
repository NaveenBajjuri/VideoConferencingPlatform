import io from "socket.io-client";
import { Device } from "mediasoup-client";

class SfuClient {
    constructor(socket, iceServers = []) {
        this.socket = socket;
        this.iceServers = iceServers;
        this.device = null;
        this.sendTransport = null;
        this.recvTransport = null;
        this.producers = new Map();
        this.consumersById = new Map();
        this.consumersByProducerId = new Map();
    }

    _request(event, payload = {}) {
        return new Promise((resolve, reject) => {
            this.socket.emit(event, payload, (response) => {
                if (response && response.error) {
                    reject(new Error(`${event} failed: ${response.error}`));
                } else {
                    resolve(response);
                }
            });
        });
    }

    async load() {
        const { rtpCapabilities, error } = await this._request("get-router-rtp-capabilities");
        if (error) throw new Error(error);
        this.device = new Device();
        await this.device.load({ routerRtpCapabilities: rtpCapabilities });
        return this.device;
    }

    async _createTransport(direction) {
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

        return transport;
    }

    async ensureSendTransport() {
        if (!this.sendTransport) {
            this.sendTransport = await this._createTransport("send");
        }
        return this.sendTransport;
    }

    async ensureRecvTransport() {
        if (!this.recvTransport) {
            this.recvTransport = await this._createTransport("recv");
        }
        return this.recvTransport;
    }

    async produce(name, track) {
        if (!track) return null;
        const transport = await this.ensureSendTransport();
        const producer = await transport.produce({
            track,
            appData: { mediaType: name },
        });

        producer.on("transportclose", () => {
            this.producers.delete(name);
        });

        this.producers.set(name, producer);
        return producer;
    }

    async replaceTrack(name, newTrack) {
        const producer = this.producers.get(name);
        if (!producer) throw new Error(`No active producer named ${name}`);
        await producer.replaceTrack({ track: newTrack });
    }

    async closeProducer(name) {
        const producer = this.producers.get(name);
        if (!producer) return;
        producer.close();
        this.producers.delete(name);
        await this._request("close-producer", { producerId: producer.id });
    }

    async getExistingProducers() {
        const { producers, error } = await this._request("get-producers");
        if (error) throw new Error(error);
        return producers || [];
    }

    async consume({ producerId, socketId, kind, appData = {} }) {
        if (this.consumersByProducerId.has(producerId)) {
            return this.consumersByProducerId.get(producerId);
        }

        const transport = await this.ensureRecvTransport();
        const { rtpCapabilities } = this.device;
        const { params } = await this._request("consume", {
            transportId: transport.id,
            producerId,
            rtpCapabilities,
        });

        const consumer = await transport.consume({
            id: params.id,
            producerId: params.producerId,
            kind: params.kind,
            rtpParameters: params.rtpParameters,
            appData: { ...appData, socketId },
        });

        this.consumersById.set(consumer.id, consumer);
        this.consumersByProducerId.set(producerId, consumer);

        await this._request("resume-consumer", { consumerId: consumer.id });
        return consumer;
    }

    closeConsumerByProducerId(producerId) {
        const consumer = this.consumersByProducerId.get(producerId);
        if (!consumer) return null;
        consumer.close();
        this.consumersById.delete(consumer.id);
        this.consumersByProducerId.delete(producerId);
        return consumer;
    }
}

function createSyntheticMedia() {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    let color = 0;
    setInterval(() => {
        ctx.fillStyle = "rgb(" + (color % 255) + ", 100, 150)";
        ctx.fillRect(0, 0, 640, 480);
        color += 5;
    }, 40);

    const vStream = canvas.captureStream(30);

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContextClass();
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const dst = audioCtx.createMediaStreamDestination();
    osc.connect(dst);
    osc.start();

    return new MediaStream([
        ...vStream.getVideoTracks(),
        ...dst.stream.getAudioTracks()
    ]);
}

window.callState = {
    joined: false,
    producers: {},
    consumers: {},
    remoteProducerIds: [],
    closedProducerIds: [],
    activeSpeakers: [],
    wbActions: [],
    wbCleared: false,
    polls: [],
};

window.initCall = async (serverUrl, room, name) => {
    const socket = io(serverUrl, { transports: ["websocket"] });
    window.socket = socket;

    await new Promise((resolve) => socket.once("connect", resolve));

    socket.emit("join-call", room, name);
    await new Promise((resolve) => socket.once("participants-update", resolve));
    window.callState.joined = true;

    const sfu = new SfuClient(socket);
    window.sfu = sfu;
    await sfu.load();

    const stream = createSyntheticMedia();
    window.localStream = stream;

    const micTrack = stream.getAudioTracks()[0];
    const camTrack = stream.getVideoTracks()[0];

    const mic = await sfu.produce("mic", micTrack);
    const cam = await sfu.produce("webcam", camTrack);
    window.callState.producers["mic"] = mic.id;
    window.callState.producers["webcam"] = cam.id;

    // Consume existing
    const existing = await sfu.getExistingProducers();
    for (const p of existing) {
        await sfu.consume(p);
        window.callState.consumers[p.producerId] = p;
        window.callState.remoteProducerIds.push(p.producerId);
    }

    socket.on("new-producer", async (p) => {
        window.callState.remoteProducerIds.push(p.producerId);
        await sfu.consume(p);
        window.callState.consumers[p.producerId] = p;
    });

    socket.on("producer-closed", ({ producerId }) => {
        window.callState.closedProducerIds.push(producerId);
        sfu.closeConsumerByProducerId(producerId);
        delete window.callState.consumers[producerId];
    });

    socket.on("active-speaker", (data) => {
        window.callState.activeSpeakers.push(data);
    });

    socket.on("wb-draw", (action) => {
        window.callState.wbActions.push(action);
    });

    socket.on("wb-clear", () => {
        window.callState.wbCleared = true;
    });

    socket.on("new-poll", (poll) => {
        window.callState.polls.push(poll);
    });

    socket.on("poll-updated", (poll) => {
        const idx = window.callState.polls.findIndex((p) => p.id === poll.id);
        if (idx !== -1) window.callState.polls[idx] = poll;
        else window.callState.polls.push(poll);
    });

    return true;
};

window.drawWhiteboard = (action) => {
    window.socket.emit("wb-draw", action);
};

window.clearWhiteboard = () => {
    window.socket.emit("wb-clear");
};

window.createPoll = (question, options) => {
    return new Promise((resolve) => {
        window.socket.emit("create-poll", { question, options }, resolve);
    });
};

window.votePoll = (pollId, optionId) => {
    return new Promise((resolve) => {
        window.socket.emit("vote-poll", { pollId, optionId }, resolve);
    });
};

window.endPoll = (pollId) => {
    return new Promise((resolve) => {
        window.socket.emit("end-poll", { pollId }, resolve);
    });
};

window.replaceVideoTrack = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    let c = 0;
    setInterval(() => {
        ctx.fillStyle = "rgb(0, " + (c % 255) + ", 200)";
        ctx.fillRect(0, 0, 640, 480);
        c += 10;
    }, 40);
    const stream = canvas.captureStream(30);
    const newTrack = stream.getVideoTracks()[0];
    await window.sfu.replaceTrack("webcam", newTrack);
    return true;
};

window.startScreenShare = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    let s = 0;
    setInterval(() => {
        ctx.fillStyle = "rgb(0, 200, " + (s % 255) + ")";
        ctx.fillRect(0, 0, 1280, 720);
        s += 5;
    }, 40);
    const stream = canvas.captureStream(30);
    const screenTrack = stream.getVideoTracks()[0];
    const producer = await window.sfu.produce("screen", screenTrack);
    window.callState.producers["screen"] = producer.id;
    return producer.id;
};

window.stopScreenShare = async () => {
    await window.sfu.closeProducer("screen");
    delete window.callState.producers["screen"];
    return true;
};
