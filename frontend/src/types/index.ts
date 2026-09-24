export interface SfuVideoTile {
    socketId: string;
    kind: "camera" | "screen";
    stream: MediaStream;
}

export interface Participant {
    socketId: string;
    name: string;
    isHost: boolean;
}

export interface WaitingParticipant {
    socketId: string;
    name: string;
}

export interface ChatMessage {
    data: string;
    sender: string;
    socketId: string;
}

export interface User {
    name: string;
    username: string;
}

export interface AuthContextType {
    userData: User | null;
    setUserData: (user: User | null) => void;
    handleRegister: (name: string, username: string, password: string) => Promise<string>;
    handleLogin: (username: string, password: string) => Promise<void>;
    handleLogout: () => Promise<void>;
    getHistoryOfUser: (page?: number, limit?: number, search?: string) => Promise<any>;
    addToUserHistory: (meetingCode: string) => Promise<any>;
}

export interface TurnServerConfig {
    urls: string;
    username?: string;
    credential?: string;
}

export interface ActiveSpeakerData {
    socketId: string | null;
    producerId?: string;
    volume?: number;
}

export interface NetworkQuality {
    rtt: number;
    packetLoss: number;
    bitrate: number;
    quality: "good" | "fair" | "poor";
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

