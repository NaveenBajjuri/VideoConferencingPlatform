import config from "../config/config.js";
import type { types as mediasoupTypes } from "mediasoup";

export const mediaCodecs: mediasoupTypes.RtpCodecCapability[] = [
    {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
    },
    {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {
            "x-google-start-bitrate": 1000,
        },
    },
    {
        kind: "video",
        mimeType: "video/H264",
        clockRate: 90000,
        parameters: {
            "packetization-mode": 1,
            "profile-level-id": "42e01f",
            "level-asymmetry-allowed": 1,
            "x-google-start-bitrate": 1000,
        },
    },
] as mediasoupTypes.RtpCodecCapability[];

export const webRtcTransportOptions: mediasoupTypes.WebRtcTransportOptions = {
    listenIps: [
        {
            ip: config.mediasoup.listenIp,
            announcedIp: config.mediasoup.announcedIp || undefined,
        },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 800000,
};
