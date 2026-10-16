// ==================================================
// STUDYTRACK V2
// HABITS API
// ==================================================

const express = require("express");
const db = require("../db");

const router = express.Router();


// ==================================================
// AUTHENTICATION
// ==================================================

function requireAuthentication(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Please log in to access your habits."
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

function validateFrequency(frequency) {
    return [
        "daily",
        "weekdays",
        "weekly"
    ].includes(frequency);
}

function validateStatus(status) {
    return status === "active" || status === "archived";
}


// ==================================================
// DATE VALIDATION
// ==================================================

/**
 * Validate a date in YYYY-MM-DD format.
 *
 * An omitted date is allowed because the application
 * supplies today's local date as the default.
 */
function validateStartDate(startDate) {
    if (
        startDate === undefined ||
        startDate === null ||
        startDate === ""
    ) {
        return true;
    }

    if (
        typeof startDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(startDate)
    ) {
        return false;
    }

    // IMPORTANT:
    // Keep the date and time together without spaces.
    const date = new Date(`${startDate}T00:00:00.000Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === startDate
    );
}


/**
 * Validate a habit completion date in YYYY-MM-DD format.
 */
function validateRecordDate(dateString) {
    if (
        typeof dateString !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ) {
        return false;
    }

    // IMPORTANT:
    // Keep the date and time together without spaces.
    const parsed = new Date(`${dateString}T00:00:00.000Z`);

    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === dateString
    );
}


// ==================================================
// LOCAL DATE HELPER
// ==================================================

/**
 * Return today's local calendar date in YYYY-MM-DD format.
 *
 * Example: 2026-10-16
 */
function getLocalDateString() {
    const now = new Date();

    const year = now.getFullYear();

    const month = String(
        now.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        now.getDate()
    ).padStart(2, "0");

    // IMPORTANT:
    // Do not insert spaces into the date.
    return `${ year } -${ month } -${ day }`;
}


// ==================================================
// GET ALL HABITS
// GET /api/habits
// ==================================================

router.get("/", async (req, res) => {
    try {
        const [habits] = await db.execute(
            `SELECT
h.id,
    h.user_id,
    h.title,
    h.description,
    h.frequency,
    h.start_date,
    h.status,
    h.created_at,
    h.updated_at,
    CASE
                    WHEN EXISTS(
        SELECT 1
                        FROM habit_records hr
                        WHERE hr.habit_id = h.id
                          AND hr.completion_date = CURDATE()
    )
                    THEN 1
                    ELSE 0
                END AS completed_today
             FROM habits h
             WHERE h.user_id = ?
    ORDER BY h.status ASC, h.created_at DESC`,
            [req.userId]
        );

        return res.status(200).json({
            success: true,
            count: habits.length,
            habits
        });

    } catch (error) {
        console.error(
            "Fetch habits error:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve your habits."
        });
    }
});


// ==================================================
// CREATE HABIT
// POST /api/habits
// ==================================================

router.post("/", async (req, res) => {
    try {
        const {
            title,
            description,
            frequency,
            startDate
        } = req.body;

        if (!validateTitle(title)) {
            return res.status(400).json({
                success: false,
                message:
                    "The habit title must contain between 1 and 150 characters."
            });
        }

        if (!validateDescription(description)) {
            return res.status(400).json({
                success: false,
                message:
                    "The description must not exceed 10,000 characters."
            });
        }

        const cleanFrequency =
            frequency === undefined ? "daily" : frequency;

        if (!validateFrequency(cleanFrequency)) {
            return res.status(400).json({
                success: false,
                message:
                    "Choose daily, weekdays, or weekly frequency."
            });
        }

        if (!validateStartDate(startDate)) {
            return res.status(400).json({
                success: false,
                message:
                    "Please provide a valid start date in YYYY-MM-DD format."
            });
        }

        const cleanDescription =
            typeof description === "string" && description.trim()
                ? description.trim()
                : null;

        const cleanStartDate =
            startDate || getLocalDateString();

        const [result] = await db.execute(
            `INSERT INTO habits(
        user_id,
        title,
        description,
        frequency,
        start_date
    )
VALUES(?, ?, ?, ?, ?)`,
            [
                req.userId,
                title.trim(),
                cleanDescription,
                cleanFrequency,
                cleanStartDate
            ]
        );

        const [habits] = await db.execute(
            `SELECT
id,
    user_id,
    title,
    description,
    frequency,
    start_date,
    status,
    created_at,
    updated_at
             FROM habits
             WHERE id = ?
    AND user_id = ?
        LIMIT 1`,
            [result.insertId, req.userId]
        );

        return res.status(201).json({
            success: true,
            message: "Habit created successfully.",
            habit: habits[0]
        });

    } catch (error) {
        console.error(
            "Create habit error:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to create your habit."
        });
    }
});


// ==================================================
// GET ONE HABIT
// GET /api/habits/:id
// ==================================================

router.get("/:id", async (req, res) => {
    try {
        const habitId = Number(req.params.id);

        if (!Number.isSafeInteger(habitId) || habitId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid habit ID."
            });
        }

        const [habits] = await db.execute(
            `SELECT
id,
    user_id,
    title,
    description,
    frequency,
    start_date,
    status,
    created_at,
    updated_at
             FROM habits
             WHERE id = ?
    AND user_id = ?
        LIMIT 1`,
            [habitId, req.userId]
        );

        if (habits.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Habit not found."
            });
        }

        return res.status(200).json({
            success: true,
            habit: habits[0]
        });

    } catch (error) {
        console.error(
            "Fetch habit error:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve this habit."
        });
    }
});


// ==================================================
// UPDATE HABIT
// PUT /api/habits/:id
// ==================================================

router.put("/:id", async (req, res) => {
    try {
        const habitId = Number(req.params.id);

        if (!Number.isSafeInteger(habitId) || habitId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid habit ID."
            });
        }

        const {
            title,
            description,
            frequency,
            startDate,
            status
        } = req.body;

        if (
            !validateTitle(title) ||
            !validateDescription(description) ||
            !validateFrequency(frequency) ||
            !validateStartDate(startDate) ||
            !validateStatus(status)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid habit details. Check the title, description, frequency, start date, and status."
            });
        }

        const cleanDescription =
            typeof description === "string" && description.trim()
                ? description.trim()
                : null;

        const cleanStartDate =
            startDate || getLocalDateString();

        const [result] = await db.execute(
            `UPDATE habits
SET
title = ?,
    description = ?,
    frequency = ?,
    start_date = ?,
    status = ?
        WHERE id = ?
            AND user_id = ?`,
            [
                title.trim(),
                cleanDescription,
                frequency,
                cleanStartDate,
                status,
                habitId,
                req.userId
            ]
        );

        if (result.affectedRows === 0) {
            const [existing] = await db.execute(
                `SELECT id
                 FROM habits
                 WHERE id = ?
    AND user_id = ?
        LIMIT 1`,
                [habitId, req.userId]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Habit not found."
                });
            }
        }

        const [habits] = await db.execute(
            `SELECT
id,
    user_id,
    title,
    description,
    frequency,
    start_date,
    status,
    created_at,
    updated_at
             FROM habits
             WHERE id = ?
    AND user_id = ?
        LIMIT 1`,
            [habitId, req.userId]
        );

        return res.status(200).json({
            success: true,
            message: "Habit updated successfully.",
            habit: habits[0]
        });

    } catch (error) {
        console.error(
            "Update habit error:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to update your habit."
        });
    }
});


// ==================================================
// COMPLETE HABIT FOR A DATE
// PUT /api/habits/:id/records/:date
// ==================================================

router.put("/:id/records/:date", async (req, res) => {
    try {
        const habitId = Number(req.params.id);
        const completionDate = req.params.date;

        if (!Number.isSafeInteger(habitId) || habitId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid habit ID."
            });
        }

        if (!validateRecordDate(completionDate)) {
            return res.status(400).json({
                success: false,
                message:
                    "Please provide a valid completion date in YYYY-MM-DD format."
            });
        }

        const localToday = getLocalDateString();

        const [habits] = await db.execute(
            `SELECT
id,
    start_date,
    status
             FROM habits
             WHERE id = ?
    AND user_id = ?
        LIMIT 1`,
            [habitId, req.userId]
        );

        if (habits.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Habit not found."
            });
        }

        const habit = habits[0];

        if (habit.status !== "active") {
            return res.status(400).json({
                success: false,
                message:
                    "Archived habits cannot be marked complete."
            });
        }

        const startDate =
            String(habit.start_date).slice(0, 10);

        if (completionDate < startDate) {
            return res.status(400).json({
                success: false,
                message:
                    "A habit cannot be completed before its start date."
            });
        }

        if (completionDate > localToday) {
            return res.status(400).json({
                success: false,
                message:
                    "A habit cannot be completed for a future date."
            });
        }

        await db.execute(
            `INSERT INTO habit_records(
            habit_id,
            completion_date
        )
VALUES(?, ?)
            ON DUPLICATE KEY UPDATE
completion_date = VALUES(completion_date)`,
            [habitId, completionDate]
        );

        return res.status(200).json({
            success: true,
            message: "Habit marked complete.",
            habitId,
            completionDate,
            completed: true
        });

    } catch (error) {
        console.error(
            "Complete habit error:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to record habit completion."
        });
    }
});


// ==================================================
// UNDO HABIT COMPLETION
// DELETE /api/habits/:id/records/:date
// ==================================================

router.delete("/:id/records/:date", async (req, res) => {
    try {
        const habitId = Number(req.params.id);
        const completionDate = req.params.date;

        if (!Number.isSafeInteger(habitId) || habitId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid habit ID."
            });
        }

        if (!validateRecordDate(completionDate)) {
            return res.status(400).json({
                success: false,
                message:
                    "Please provide a valid completion date in YYYY-MM-DD format."
            });
        }

        const [result] = await db.execute(
            `DELETE hr
             FROM habit_records hr
             INNER JOIN habits h
                ON h.id = hr.habit_id
             WHERE hr.habit_id = ?
    AND hr.completion_date = ?
        AND h.user_id = ?`,
            [habitId, completionDate, req.userId]
        );

        if (result.affectedRows === 0) {
            const [habits] = await db.execute(
                `SELECT id
                 FROM habits
                 WHERE id = ?
    AND user_id = ?
        LIMIT 1`,
                [habitId, req.userId]
            );

            if (habits.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Habit not found."
                });
            }

            return res.status(404).json({
                success: false,
                message:
                    "No completion record exists for that date."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Habit completion undone.",
            habitId,
            completionDate,
            completed: false
        });

    } catch (error) {
        console.error(
            "Undo habit completion error:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to undo habit completion."
        });
    }
});


// ==================================================
// GET HABIT COMPLETION HISTORY
// GET /api/habits/:id/records
// ==================================================

router.get("/:id/records", async (req, res) => {
    try {
        const habitId = Number(req.params.id);

        if (!Number.isSafeInteger(habitId) || habitId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid habit ID."
            });
        }

        const [habits] = await db.execute(
            `SELECT id
             FROM habits
             WHERE id = ?
    AND user_id = ?
        LIMIT 1`,
            [habitId, req.userId]
        );

        if (habits.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Habit not found."
            });
        }

        const [records] = await db.execute(
            `SELECT
id,
    habit_id,
    completion_date,
    created_at
             FROM habit_records
             WHERE habit_id = ?
    ORDER BY completion_date DESC`,
            [habitId]
        );

        return res.status(200).json({
            success: true,
            count: records.length,
            records
        });

    } catch (error) {
        console.error(
            "Fetch habit history error:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve habit history."
        });
    }
});


// ==================================================
// DELETE HABIT
// DELETE /api/habits/:id
// ==================================================

router.delete("/:id", async (req, res) => {
    try {
        const habitId = Number(req.params.id);

        if (!Number.isSafeInteger(habitId) || habitId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid habit ID."
            });
        }

        const [result] = await db.execute(
            `DELETE FROM habits
             WHERE id = ?
    AND user_id = ?`,
            [habitId, req.userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Habit not found."
            });
        }

        return res.status(200).json({
            success: true,
            message:
                "Habit and its completion history deleted successfully."
        });

    } catch (error) {
        console.error(
            "Delete habit error:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to delete your habit."
        });
    }
});


// ==================================================
// EXPORT ROUTER
// ==================================================

module.exports = router;


