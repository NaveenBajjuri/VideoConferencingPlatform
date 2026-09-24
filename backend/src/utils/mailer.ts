import nodemailer from "nodemailer";
import config from "../config/config.js";
import logger from "./logger.js";

let transporter: nodemailer.Transporter | null = null;

const isConfigured = (): boolean =>
    Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);

const getTransporter = (): nodemailer.Transporter | null => {
    if (!isConfigured()) return null;
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.port === 465,
            auth: { user: config.smtp.user, pass: config.smtp.pass },
        });
    }
    return transporter;
};

export interface InviteEmailParams {
    to: string;
    title?: string;
    meetingCode: string;
    scheduledTime?: Date | string;
    joinUrl: string;
}

export interface InviteEmailResult {
    sent: boolean;
    reason?: string;
}

export const sendMeetingInviteEmail = async ({
    to,
    title,
    meetingCode,
    scheduledTime,
    joinUrl,
}: InviteEmailParams): Promise<InviteEmailResult> => {
    const t = getTransporter();

    if (!t) {
        logger.info(
            `[mailer] SMTP not configured - skipping email invite to ${to} for meeting ${meetingCode}`
        );
        return { sent: false, reason: "SMTP not configured" };
    }

    const when = scheduledTime ? new Date(scheduledTime).toLocaleString() : "as soon as you're ready";

    const html = `
        <div style="font-family: sans-serif;">
            <h2>You're invited: ${title || "Video Meeting"}</h2>
            <p>Meeting code: <b>${meetingCode}</b></p>
            <p>Scheduled for: ${when}</p>
            <p><a href="${joinUrl}">Click here to join</a></p>
        </div>
    `;

    try {
        await t.sendMail({
            from: config.smtp.from,
            to,
            subject: `Invite: ${title || "Video Meeting"} (${meetingCode})`,
            html,
        });
        return { sent: true };
    } catch (err: any) {
        logger.error(`Failed to send meeting invite email to ${to}: ${err.message}`);
        return { sent: false, reason: err.message };
    }
};

export default { sendMeetingInviteEmail };
