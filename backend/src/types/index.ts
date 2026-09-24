import type { Request } from "express";
import type { types as mediasoupTypes } from "mediasoup";

export interface IUser {
    _id: string;
    name: string;
    username: string;
    password: string;
    email?: string;
    token?: string;
    refreshToken?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IMeeting {
    _id: string;
    user_id?: string;
    meetingCode: string;
    date: Date;
    isScheduled: boolean;
    title?: string;
    scheduledTime?: Date;
    hostUsername?: string;
    invitedEmails?: string[];
    locked: boolean;
    waitingRoomEnabled: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IChatMessage {
    _id: string;
    room: string;
    sender: string;
    socketId?: string;
    data: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface JwtPayload {
    id?: string;
    userId?: string;
    username?: string;
    type?: string;
}

export interface AuthRequest extends Request {
    user?: JwtPayload;
}

export type Direction = "send" | "recv";

export interface ProducerAppData {
    mediaType?: string;
    [key: string]: unknown;
}

export interface ConsumerAppData {
    socketId?: string;
    [key: string]: unknown;
}

export interface TransportParams {
    id: string;
    iceParameters: mediasoupTypes.IceParameters;
    iceCandidates: mediasoupTypes.IceCandidate[];
    dtlsParameters: mediasoupTypes.DtlsParameters;
}

export interface ParticipantInfo {
    socketId: string;
    name: string;
    isHost: boolean;
}

export interface WaitingParticipant {
    socketId: string;
    name: string;
}

export interface RoomState {
    host: string | null;
    locked: boolean;
    waitingRoomEnabled: boolean;
    waiting: WaitingParticipant[];
}

export interface ActiveSpeakerData {
    socketId: string | null;
    producerId?: string;
    volume?: number;
}

export interface WhiteboardAction {
    type: "draw" | "clear";
    prevX?: number;
    prevY?: number;
    currX?: number;
    currY?: number;
    color?: string;
    width?: number;
    isEraser?: boolean;
}

export interface PollOption {
    id: number;
    text: string;
    votes: number;
}

export interface Poll {
    id: string;
    question: string;
    options: PollOption[];
    voters: Record<string, number>;
    createdBy: string;
    creatorName: string;
    active: boolean;
    createdAt: number;
}

