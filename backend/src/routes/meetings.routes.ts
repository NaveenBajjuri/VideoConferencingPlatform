import { Router, type RequestHandler } from "express";
import { body } from "express-validator";

import {
    getMeetingByCode,
    getScheduledMeetings,
    scheduleMeeting,
} from "../controllers/meeting.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { handleValidation } from "../validators/auth.validator.js";

const router = Router();

const scheduleValidation = [
    body("title").optional().trim().isLength({ max: 120 }),
    body("scheduledTime").optional().isISO8601().withMessage("scheduledTime must be a valid date"),
    body("invitedEmails").optional().isArray().withMessage("invitedEmails must be an array"),
    body("invitedEmails.*").optional().isEmail().withMessage("Each invited email must be valid"),
    handleValidation,
];

router.route("/schedule").post(requireAuth as RequestHandler, ...(scheduleValidation as RequestHandler[]), scheduleMeeting as RequestHandler);
router.route("/scheduled").get(requireAuth as RequestHandler, getScheduledMeetings as RequestHandler);
router.route("/:code").get(getMeetingByCode as RequestHandler);

export default router;
