// ==================================================
// STUDYTRACK V2
// FOCUS TIMER API ROUTES
// File: server/routes/focus.js
//
// Features:
// - Save completed focus and break sessions.
// - Retrieve the logged-in user's session history.
// - Retrieve daily focus statistics.
// - Keep all session data private to its owner.
// ==================================================

const express = require("express");
const db = require("../db");

const router = express.Router();


// ==================================================
// CONFIGURATION
// ==================================================

const MAX_DURATION_SECONDS = 24 * 60 * 60;
const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;


// ==================================================
// AUTHENTICATION MIDDLEWARE
// ==================================================

function requireAuthentication(req, res, next) {
    const userId = Number(req.session?.user?.id);

    if (!req.session?.user || !Number.isSafeInteger(userId) || userId <= 0) {
        return res.status(401).json({
            success: false,
            message: "Please log in to use the Focus Timer."
        });
    }

    req.userId = userId;

    next();
}

router.use(requireAuthentication);


// ==================================================
// VALIDATION HELPERS
// ==================================================

function isValidDuration(value) {
    return (
        Number.isSafeInteger(value) &&
        value > 0 &&
        value <= MAX_DURATION_SECONDS
    );
}


function parseDate(value) {
    if (typeof value !== "string" || value.trim() === "") {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}


function toMySQLDateTime(date) {
    return date.toISOString().slice(0, 19).replace("T", " ");
}


function handleRouteError(res, error, message) {
    console.error(
        "StudyTrack Focus API error:",
        error.code || error.message
    );

    return res.status(500).json({
        success: false,
        message
    });
}


// ==================================================
// GET DAILY SUMMARY
// GET /api/focus/summary
//
// Returns today's completed focus sessions and
// total focus time for the authenticated user.
// ==================================================

router.get("/summary", async (req, res) => {
    try {
        const [rows] = await db.execute(
            `
            SELECT
                COUNT(*) AS completed_sessions,
                COALESCE(SUM(duration_seconds), 0)
                    AS total_focus_seconds
            FROM focus_sessions
            WHERE user_id = ?
              AND session_type = 'focus'
              AND completed_at >= CURDATE()
              AND completed_at < CURDATE() + INTERVAL 1 DAY
            `,
            [req.userId]
        );

        const [typeRows] = await db.execute(
            `
            SELECT
                session_type,
                COUNT(*) AS completed_sessions
            FROM focus_sessions
            WHERE user_id = ?
              AND completed_at >= CURDATE()
              AND completed_at < CURDATE() + INTERVAL 1 DAY
            GROUP BY session_type
            `,
            [req.userId]
        );

        const sessionsByType = {
            focus: 0,
            short_break: 0,
            long_break: 0
        };

        for (const row of typeRows) {
            sessionsByType[row.session_type] =
                Number(row.completed_sessions);
        }

        res.status(200).json({
            success: true,
            summary: {
                completedSessions: Number(
                    rows[0].completed_sessions
                ),
                totalFocusSeconds: Number(
                    rows[0].total_focus_seconds
                ),
                totalFocusMinutes: Math.floor(
                    Number(rows[0].total_focus_seconds) / 60
                ),
                sessionsByType
            }
        });

    } catch (error) {
        return handleRouteError(
            res,
            error,
            "Unable to load your focus statistics."
        );
    }
});


// ==================================================
// GET SESSION HISTORY
// GET /api/focus/sessions
//
// Optional query parameter:
// ?limit=20
//
// Only returns sessions belonging to the logged-in user.
// ==================================================

router.get("/sessions", async (req, res) => {
    try {
        let limit = Number.parseInt(req.query.limit, 10);

        if (!Number.isInteger(limit) || limit < 1) {
            limit = DEFAULT_HISTORY_LIMIT;
        }

        limit = Math.min(limit, MAX_HISTORY_LIMIT);

        const [rows] = await db.execute(
            `
            SELECT
                id,
                session_type,
                planned_duration_seconds,
                duration_seconds,
                started_at,
                completed_at,
                created_at
            FROM focus_sessions
            WHERE user_id = ?
            ORDER BY completed_at DESC, id DESC
            LIMIT ?
            `,
            [req.userId, limit]
        );

        const sessions = rows.map((row) => ({
            id: Number(row.id),
            sessionType: row.session_type,
            plannedDurationSeconds: Number(
                row.planned_duration_seconds
            ),
            durationSeconds: Number(
                row.duration_seconds
            ),
            startedAt: row.started_at,
            completedAt: row.completed_at,
            createdAt: row.created_at
        }));

        res.status(200).json({
            success: true,
            sessions
        });

    } catch (error) {
        return handleRouteError(
            res,
            error,
            "Unable to load your focus session history."
        );
    }
});


// ==================================================
// SAVE A COMPLETED SESSION
// POST /api/focus/sessions
//
// Expected JSON:
// {
//   "sessionType": "focus",
//   "plannedDurationSeconds": 1500,
//   "durationSeconds": 1500,
//   "startedAt": "2026-10-27T10:00:00.000Z",
//   "completedAt": "2026-10-27T10:25:00.000Z"
// }
//
// Only completed sessions should be submitted.
// The authenticated user ID comes from the session,
// never from the request body.
// ==================================================

router.post("/sessions", async (req, res) => {
    try {
        const {
            sessionType,
            plannedDurationSeconds,
            durationSeconds,
            startedAt,
            completedAt
        } = req.body || {};

        const allowedSessionTypes = [
            "focus",
            "short_break",
            "long_break"
        ];

        if (!allowedSessionTypes.includes(sessionType)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid session type."
            });
        }

        if (!isValidDuration(plannedDurationSeconds)) {
            return res.status(400).json({
                success: false,
                message: "The planned session duration is invalid."
            });
        }

        if (!isValidDuration(durationSeconds)) {
            return res.status(400).json({
                success: false,
                message: "The completed session duration is invalid."
            });
        }

        if (durationSeconds > plannedDurationSeconds) {
            return res.status(400).json({
                success: false,
                message: "The completed duration cannot exceed the planned duration."
            });
        }

        const startDate = parseDate(startedAt);
        const completionDate = parseDate(completedAt);

        if (!startDate || !completionDate) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid session timestamps."
            });
        }

        if (completionDate <= startDate) {
            return res.status(400).json({
                success: false,
                message: "The completion time must be after the start time."
            });
        }

        const elapsedSeconds = Math.floor(
            (completionDate.getTime() - startDate.getTime()) / 1000
        );

        if (elapsedSeconds < 1) {
            return res.status(400).json({
                success: false,
                message: "The session duration is too short."
            });
        }

        // Prevent inconsistent timestamps from being saved.
        // Allow a small difference for timer and network timing.
        if (Math.abs(elapsedSeconds - durationSeconds) > 5) {
            return res.status(400).json({
                success: false,
                message: "The session duration does not match its timestamps."
            });
        }

        const [result] = await db.execute(
            `
            INSERT INTO focus_sessions (
                user_id,
                session_type,
                planned_duration_seconds,
                duration_seconds,
                started_at,
                completed_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                req.userId,
                sessionType,
                plannedDurationSeconds,
                durationSeconds,
                toMySQLDateTime(startDate),
                toMySQLDateTime(completionDate)
            ]
        );

        res.status(201).json({
            success: true,
            message: "Focus session saved successfully.",
            session: {
                id: Number(result.insertId),
                sessionType,
                plannedDurationSeconds,
                durationSeconds,
                startedAt: startDate.toISOString(),
                completedAt: completionDate.toISOString()
            }
        });

    } catch (error) {
        return handleRouteError(
            res,
            error,
            "Unable to save your completed focus session."
        );
    }
});


// ==================================================
// EXPORT ROUTER
// ==================================================

module.exports = router;