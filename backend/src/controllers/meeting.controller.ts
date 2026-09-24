import type { Response } from "express";
import crypto from "crypto";
import httpStatus from "http-status";

import { Meeting } from "../models/meeting.model.js";
import { sendMeetingInviteEmail } from "../utils/mailer.js";
import logger from "../utils/logger.js";
import type { AuthRequest } from "../types/index.js";

const generateMeetingCode = (): string => crypto.randomBytes(4).toString("hex");

export const scheduleMeeting = async (req: AuthRequest, res: Response) => {
    const { title, scheduledTime, invitedEmails, frontendOrigin } = req.body;

    try {
        const username = req.user?.username;
        const meetingCode = generateMeetingCode();

        const meeting = new Meeting({
            user_id: username,
            meetingCode,
            isScheduled: true,
            title: title || "Untitled Meeting",
            scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined,
            hostUsername: username,
            invitedEmails: Array.isArray(invitedEmails) ? invitedEmails : [],
        });

        await meeting.save();

        const origin = frontendOrigin || "http://localhost:3000";
        const joinUrl = `${origin}/${meetingCode}`;

        const emailResults = [];
        for (const email of meeting.invitedEmails || []) {
            const result = await sendMeetingInviteEmail({
                to: email,
                title: meeting.title,
                meetingCode,
                scheduledTime: meeting.scheduledTime,
                joinUrl,
            });
            emailResults.push({ email, ...result });
        }

        return res.status(httpStatus.CREATED).json({ meeting, joinUrl, emailResults });
    } catch (e: any) {
        logger.error(`scheduleMeeting failed: ${e.message}`);
        return res
            .status(httpStatus.INTERNAL_SERVER_ERROR)
            .json({ message: "Something went wrong scheduling the meeting" });
    }
};

export const getScheduledMeetings = async (req: AuthRequest, res: Response) => {
    try {
        const username = req.user?.username;
        const meetings = await Meeting.find({ hostUsername: username, isScheduled: true }).sort({
            scheduledTime: 1,
        });
        return res.json({ meetings });
    } catch (e: any) {
        logger.error(`getScheduledMeetings failed: ${e.message}`);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Something went wrong" });
    }
};

export const getMeetingByCode = async (req: AuthRequest, res: Response) => {
    try {
        const meeting = await Meeting.findOne({ meetingCode: req.params.code }).sort({ createdAt: -1 });
        if (!meeting) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "Meeting not found" });
        }
        return res.json({ meeting });
    } catch (e: any) {
        logger.error(`getMeetingByCode failed: ${e.message}`);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ message: "Something went wrong" });
    }
};

export default { scheduleMeeting, getScheduledMeetings, getMeetingByCode };
