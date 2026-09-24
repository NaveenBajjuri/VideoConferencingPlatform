import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { IMeeting } from "../types/index.js";

export interface MeetingDocument extends IMeeting, Document {
    _id: string;
}

const meetingSchema = new Schema<MeetingDocument>(
    {
        user_id: { type: String },
        meetingCode: { type: String, required: true, index: true },
        date: { type: Date, default: Date.now, required: true },
        isScheduled: { type: Boolean, default: false },
        title: { type: String, trim: true },
        scheduledTime: { type: Date },
        hostUsername: { type: String },
        invitedEmails: [{ type: String, trim: true, lowercase: true }],
        locked: { type: Boolean, default: false },
        waitingRoomEnabled: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export const Meeting: Model<MeetingDocument> = mongoose.model<MeetingDocument>("Meeting", meetingSchema);
export default Meeting;
