import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { IChatMessage } from "../types/index.js";

export interface ChatMessageDocument extends IChatMessage, Document {
    _id: string;
}

const chatMessageSchema = new Schema<ChatMessageDocument>(
    {
        room: { type: String, required: true, index: true },
        sender: { type: String, required: true },
        socketId: { type: String },
        data: { type: String, required: true },
    },
    { timestamps: true }
);

chatMessageSchema.index({ room: 1, createdAt: 1 });

export const ChatMessage: Model<ChatMessageDocument> = mongoose.model<ChatMessageDocument>(
    "ChatMessage",
    chatMessageSchema
);
export default ChatMessage;
