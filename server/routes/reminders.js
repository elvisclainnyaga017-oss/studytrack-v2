// ==================================================
// STUDYTRACK V2
// REMINDERS API
// File: server/routes/reminders.js
// ==================================================

"use strict";

const express = require("express");
const db = require("../db");

const router = express.Router();


// ==================================================
// AUTHENTICATION MIDDLEWARE
// ==================================================

function requireAuthentication(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Please log in to access your reminders."
        });
    }

    const userId = Number(req.session.user.id);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
        return res.status(401).json({
            success: false,
            message: "Your session is invalid. Please log in again."
        });
    }

    req.userId = userId;

    next();
}


// Protect every Reminders API endpoint.

router.use(requireAuthentication);


// ==================================================
// VALIDATION HELPERS
// ==================================================

function validateTitle(title) {
    return (
        typeof title === "string" &&
        title.trim().length >= 1 &&
        title.trim().length <= 150
    );
}


function validateDescription(description) {
    return (
        description === undefined ||
        description === null ||
        (
            typeof description === "string" &&
            description.length <= 10000
        )
    );
}


function validateStatus(status) {
    return [
        "pending",
        "completed"
    ].includes(status);
}


/**
 * Validate a reminder date and time.
 *
 * Accepts:
 * YYYY-MM-DDTHH:mm
 * YYYY-MM-DD HH:mm
 * YYYY-MM-DDTHH:mm:ss
 * YYYY-MM-DD HH:mm:ss
 *
 * The value is validated without converting it to UTC.
 * This avoids accidental date/time shifts when saving
 * HTML datetime-local input.
 */
function validateRemindAt(value) {
    if (typeof value !== "string") {
        return false;
    }

    const normalized = value.replace("T", " ");

    const match = normalized.match(
        /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/
    );

    if (!match) {
        return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6] || "0");

    if (
        year < 1000 ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31 ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59 ||
        second < 0 ||
        second > 59
    ) {
        return false;
    }

    const parsedDate = new Date(
        Date.UTC(year, month - 1, day, hour, minute, second)
    );

    return (
        parsedDate.getUTCFullYear() === year &&
        parsedDate.getUTCMonth() === month - 1 &&
        parsedDate.getUTCDate() === day &&
        parsedDate.getUTCHours() === hour &&
        parsedDate.getUTCMinutes() === minute &&
        parsedDate.getUTCSeconds() === second
    );
}


/**
 * Convert an already-validated reminder date/time into
 * MariaDB's YYYY-MM-DD HH:mm:ss DATETIME format.
 *
 * No timezone conversion is performed.
 */
function normalizeRemindAt(value) {
    const normalized = value.replace("T", " ");

    return normalized.length === 16
        ? `${ normalized }:00`
        : normalized;
}


/**
 * Validate a reminder ID from the URL.
 */
function parseReminderId(value) {
    if (
        typeof value !== "string" ||
        !/^[1-9]\d*$/.test(value)
    ) {
        return null;
    }

    const id = Number(value);

    return Number.isSafeInteger(id) ? id : null;
}


/**
 * Return a consistent reminder representation.
 *
 * DATE_FORMAT returns a predictable local DATETIME
 * string rather than a JavaScript Date object.
 */
const REMINDER_SELECT = `
SELECT
id,
    user_id,
    title,
    description,
    DATE_FORMAT(
        remind_at,
        '%Y-%m-%d %H:%i:%s'
    ) AS remind_at,
        status,
        created_at,
        updated_at
    FROM reminders
    `;


// ==================================================
// GET ALL REMINDERS
// GET /api/reminders
// ==================================================

router.get("/", async (req, res) => {
    try {
        const conditions = ["user_id = ?"];
        const parameters = [req.userId];

        // Optional status filter.

        if (req.query.status !== undefined) {
            if (!validateStatus(req.query.status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid reminder status."
                });
            }

            conditions.push("status = ?");
            parameters.push(req.query.status);
        }

        // Optional search by title or description.

        if (req.query.search !== undefined) {
            if (
                typeof req.query.search !== "string" ||
                req.query.search.length > 200
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Search text must not exceed 200 characters."
                });
            }

            const search = req.query.search.trim();

            if (search.length > 0) {
                conditions.push(
                    "(title LIKE ? OR description LIKE ?)"
                );

                const searchPattern = `% ${ search }%`;

                parameters.push(
                    searchPattern,
                    searchPattern
                );
            }
        }

        // Whitelist sorting options.

        const sortOptions = {
            remind_at: "remind_at ASC, created_at DESC",
            newest: "created_at DESC",
            oldest: "created_at ASC",
            updated_at: "updated_at DESC",
            title: "title ASC"
        };

        const requestedSort = req.query.sort || "remind_at";

        if (
            !Object.prototype.hasOwnProperty.call(
                sortOptions,
                requestedSort
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid reminder sorting option."
            });
        }

        const sql = `
            ${ REMINDER_SELECT }
            WHERE ${ conditions.join(" AND ") }
            ORDER BY ${ sortOptions[requestedSort] }
`;

        const [reminders] = await db.execute(
            sql,
            parameters
        );

        return res.status(200).json({
            success: true,
            count: reminders.length,
            reminders
        });

    } catch (error) {
        console.error(
            "Get reminders failed:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve reminders."
        });
    }
});


// ==================================================
// GET REMINDER SUMMARY
// GET /api/reminders/summary
// ==================================================

router.get("/summary", async (req, res) => {
    try {
        const [rows] = await db.execute(
            `
SELECT
COUNT(*) AS total_reminders,

    COALESCE(
        SUM(status = 'pending'),
        0
    ) AS pending_reminders,

        COALESCE(
            SUM(status = 'completed'),
            0
        ) AS completed_reminders,

            COALESCE(
                SUM(
                    status = 'pending'
                            AND remind_at < NOW()
                ),
                0
            ) AS overdue_reminders,

                COALESCE(
                    SUM(
                        status = 'pending'
                            AND remind_at >= NOW()
                    ),
                    0
                ) AS upcoming_reminders

                FROM reminders
                WHERE user_id = ?
    `,
            [req.userId]
        );

        return res.status(200).json({
            success: true,
            summary: rows[0]
        });

    } catch (error) {
        console.error(
            "Get reminder summary failed:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve reminder statistics."
        });
    }
});


// ==================================================
// GET ONE REMINDER
// GET /api/reminders/:id
// ==================================================

router.get("/:id", async (req, res) => {
    const reminderId = parseReminderId(req.params.id);

    if (!reminderId) {
        return res.status(400).json({
            success: false,
            message: "Invalid reminder ID."
        });
    }

    try {
        const [reminders] = await db.execute(
            `
                ${ REMINDER_SELECT }
                WHERE id = ?
    AND user_id = ?
        LIMIT 1
            `,
            [reminderId, req.userId]
        );

        if (reminders.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Reminder not found."
            });
        }

        return res.status(200).json({
            success: true,
            reminder: reminders[0]
        });

    } catch (error) {
        console.error(
            "Get reminder failed:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve the reminder."
        });
    }
});


// ==================================================
// CREATE REMINDER
// POST /api/reminders
// ==================================================

router.post("/", async (req, res) => {
    const {
        title,
        description = null,
        remind_at,
        status = "pending"
    } = req.body || {};

    if (!validateTitle(title)) {
        return res.status(400).json({
            success: false,
            message: "Reminder title is required and must not exceed 150 characters."
        });
    }

    if (!validateDescription(description)) {
        return res.status(400).json({
            success: false,
            message: "Description must not exceed 10,000 characters."
        });
    }

    if (!validateRemindAt(remind_at)) {
        return res.status(400).json({
            success: false,
            message: "Reminder date and time must be valid."
        });
    }

    if (!validateStatus(status)) {
        return res.status(400).json({
            success: false,
            message: "Status must be pending or completed."
        });
    }

    try {
        const [result] = await db.execute(
            `
                INSERT INTO reminders(
                user_id,
                title,
                description,
                remind_at,
                status
            )
VALUES(?, ?, ?, ?, ?)
    `,
            [
                req.userId,
                title.trim(),
                description === null
                    ? null
                    : description.trim(),
                normalizeRemindAt(remind_at),
                status
            ]
        );

        const [reminders] = await db.execute(
            `
                ${ REMINDER_SELECT }
                WHERE id = ?
    AND user_id = ?
        LIMIT 1
            `,
            [result.insertId, req.userId]
        );

        return res.status(201).json({
            success: true,
            message: "Reminder created successfully.",
            reminder: reminders[0]
        });

    } catch (error) {
        console.error(
            "Create reminder failed:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to create the reminder."
        });
    }
});


// ==================================================
// UPDATE REMINDER
// PUT /api/reminders/:id
// ==================================================

router.put("/:id", async (req, res) => {
    const reminderId = parseReminderId(req.params.id);

    if (!reminderId) {
        return res.status(400).json({
            success: false,
            message: "Invalid reminder ID."
        });
    }

    const body = req.body || {};

    const {
        title,
        description = null,
        remind_at,
        status
    } = body;

    if (!validateTitle(title)) {
        return res.status(400).json({
            success: false,
            message: "Reminder title is required and must not exceed 150 characters."
        });
    }

    if (!validateDescription(description)) {
        return res.status(400).json({
            success: false,
            message: "Description must not exceed 10,000 characters."
        });
    }

    if (!validateRemindAt(remind_at)) {
        return res.status(400).json({
            success: false,
            message: "Reminder date and time must be valid."
        });
    }

    if (!validateStatus(status)) {
        return res.status(400).json({
            success: false,
            message: "Status must be pending or completed."
        });
    }

    try {
        const [result] = await db.execute(
            `
                UPDATE reminders
SET
title = ?,
    description = ?,
    remind_at = ?,
    status = ?
        WHERE id = ?
            AND user_id = ?
                `,
            [
                title.trim(),
                description === null
                    ? null
                    : description.trim(),
                normalizeRemindAt(remind_at),
                status,
                reminderId,
                req.userId
            ]
        );

        if (result.affectedRows === 0) {
            const [existing] = await db.execute(
                `
                    SELECT id
                    FROM reminders
                    WHERE id = ?
    AND user_id = ?
        LIMIT 1
            `,
                [reminderId, req.userId]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Reminder not found."
                });
            }
        }

        const [reminders] = await db.execute(
            `
                ${ REMINDER_SELECT }
                WHERE id = ?
    AND user_id = ?
        LIMIT 1
            `,
            [reminderId, req.userId]
        );

        return res.status(200).json({
            success: true,
            message: "Reminder updated successfully.",
            reminder: reminders[0]
        });

    } catch (error) {
        console.error(
            "Update reminder failed:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to update the reminder."
        });
    }
});


// ==================================================
// UPDATE REMINDER STATUS
// PATCH /api/reminders/:id/status
// ==================================================

router.patch("/:id/status", async (req, res) => {
    const reminderId = parseReminderId(req.params.id);
    const { status } = req.body || {};

    if (!reminderId) {
        return res.status(400).json({
            success: false,
            message: "Invalid reminder ID."
        });
    }

    if (!validateStatus(status)) {
        return res.status(400).json({
            success: false,
            message: "Status must be pending or completed."
        });
    }

    try {
        const [result] = await db.execute(
            `
                UPDATE reminders
                SET status = ?
    WHERE id = ?
        AND user_id = ?
            `,
            [
                status,
                reminderId,
                req.userId
            ]
        );

        if (result.affectedRows === 0) {
            const [existing] = await db.execute(
                `
                    SELECT id
                    FROM reminders
                    WHERE id = ?
    AND user_id = ?
        LIMIT 1
            `,
                [reminderId, req.userId]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Reminder not found."
                });
            }
        }

        const [reminders] = await db.execute(
            `
                ${ REMINDER_SELECT }
                WHERE id = ?
    AND user_id = ?
        LIMIT 1
            `,
            [reminderId, req.userId]
        );

        return res.status(200).json({
            success: true,
            message: "Reminder status updated successfully.",
            reminder: reminders[0]
        });

    } catch (error) {
        console.error(
            "Update reminder status failed:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to update reminder status."
        });
    }
});


// ==================================================
// DELETE REMINDER
// DELETE /api/reminders/:id
// ==================================================

router.delete("/:id", async (req, res) => {
    const reminderId = parseReminderId(req.params.id);

    if (!reminderId) {
        return res.status(400).json({
            success: false,
            message: "Invalid reminder ID."
        });
    }

    try {
        const [result] = await db.execute(
            `
                DELETE FROM reminders
                WHERE id = ?
    AND user_id = ?
        `,
            [
                reminderId,
                req.userId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Reminder not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Reminder deleted successfully."
        });

    } catch (error) {
        console.error(
            "Delete reminder failed:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to delete the reminder."
        });
    }
});


// ==================================================
// EXPORT ROUTER
// ==================================================

module.exports = router;

