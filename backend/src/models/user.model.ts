import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { IUser } from "../types/index.js";

export interface UserDocument extends IUser, Document {
    _id: string;
}

const userSchema = new Schema<UserDocument>(
    {
        name: { type: String, required: true, trim: true },
        username: { type: String, required: true, unique: true, trim: true, lowercase: true },
        password: { type: String, required: true },
        email: { type: String, trim: true, lowercase: true },
        token: { type: String },
        refreshToken: { type: String },
    },
    { timestamps: true }
);

export const User: Model<UserDocument> = mongoose.model<UserDocument>("User", userSchema);
export default User;
