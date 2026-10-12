// ==================================================
// STUDYTRACK V2
// GOALS API
// ==================================================

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
            message: "Please log in to access your goals."
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


// Protect every Goals API endpoint.

router.use(requireAuthentication);


// ==================================================
// VALIDATION HELPERS
// ==================================================

function validateGoalTitle(title) {
    return (
        typeof title === "string" &&
        title.trim().length >= 1 &&
        title.trim().length <= 150
    );
}


function validateDescription(description) {
    return (
        description === null ||
        description === undefined ||
        (
            typeof description === "string" &&
            description.length <= 10000
        )
    );
}


function validateTargetDate(targetDate) {
    // A target date is optional.
    if (
        targetDate === null ||
        targetDate === undefined ||
        targetDate === ""
    ) {
        return true;
    }

    // Require YYYY-MM-DD format.
    if (
        typeof targetDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)
    ) {
        return false;
    }

    // Check that the date actually exists.
    const date = new Date(
        `${targetDate}T00:00:00.000Z`
    );

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === targetDate
    );
}
function validateProgress(progress) {
    return (
        Number.isInteger(progress) &&
        progress >= 0 &&
        progress <= 100
    );
}


function validateStatus(status) {
    return (
        status === "active" ||
        status === "completed"
    );
}


// ==================================================
// GET ALL GOALS
// GET /api/goals
// ==================================================

router.get("/", async (req, res) => {
    try {
        const [goals] = await db.execute(
            `SELECT
id,
    user_id,
    title,
    description,
    target_date,
    progress,
    status,
    created_at,
    updated_at
             FROM goals
             WHERE user_id = ?
    ORDER BY created_at DESC`,
            [req.userId]
        );

        return res.status(200).json({
            success: true,
            count: goals.length,
            goals
        });

    } catch (error) {
        console.error(
            "Fetch goals error:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve your goals."
        });
    }
});


// ==================================================
// CREATE GOAL
// POST /api/goals
// ==================================================

router.post("/", async (req, res) => {
    try {
        const {
            title,
            description,
            targetDate
        } = req.body;

        if (!validateGoalTitle(title)) {
            return res.status(400).json({
                success: false,
                message: "The goal title must contain between 1 and 150 characters."
            });
        }

        if (!validateDescription(description)) {
            return res.status(400).json({
                success: false,
                message: "The description must be a string of no more than 10,000 characters."
            });
        }

        if (!validateTargetDate(targetDate)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid target date in YYYY-MM-DD format."
            });
        }

        const cleanTitle = title.trim();

        const cleanDescription =
            description === undefined ||
            description === null ||
            description === ""
                ? null
                : description;

        const cleanTargetDate =
            targetDate === undefined ||
            targetDate === null ||
            targetDate === ""
                ? null
                : targetDate;

        const [result] = await db.execute(
            `INSERT INTO goals
    (
        user_id,
        title,
        description,
        target_date
    )
VALUES(?, ?, ?, ?)`,
            [
                req.userId,
                cleanTitle,
                cleanDescription,
                cleanTargetDate
            ]
        );

        const [goals] = await db.execute(
            `SELECT
id,
    user_id,
    title,
    description,
    target_date,
    progress,
    status,
    created_at,
    updated_at
             FROM goals
             WHERE id = ?
    AND user_id = ?
        LIMIT 1`,
            [
                result.insertId,
                req.userId
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Goal created successfully.",
            goal: goals[0]
        });

    } catch (error) {
        console.error(
            "Create goal error:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to create your goal."
        });
    }
});


// ==================================================
// GET ONE GOAL
// GET /api/goals/:id
// ==================================================

router.get("/:id", async (req, res) => {
    try {
        const goalId = Number(req.params.id);

        if (
            !Number.isSafeInteger(goalId) ||
            goalId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid goal ID."
            });
        }

        const [goals] = await db.execute(
            `SELECT
id,
    user_id,
    title,
    description,
    target_date,
    progress,
    status,
    created_at,
    updated_at
             FROM goals
             WHERE id = ?
    AND user_id = ?
        LIMIT 1`,
            [
                goalId,
                req.userId
            ]
        );

        if (goals.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Goal not found."
            });
        }

        return res.status(200).json({
            success: true,
            goal: goals[0]
        });

    } catch (error) {
        console.error(
            "Fetch individual goal error:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve this goal."
        });
    }
});


// ==================================================
// UPDATE GOAL
// PUT /api/goals/:id
// ==================================================

router.put("/:id", async (req, res) => {
    try {
        const goalId = Number(req.params.id);

        if (
            !Number.isSafeInteger(goalId) ||
            goalId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid goal ID."
            });
        }

        const {
            title,
            description,
            targetDate,
            progress,
            status
        } = req.body;

        if (
            !validateGoalTitle(title) ||
            !validateDescription(description) ||
            !validateTargetDate(targetDate) ||
            !validateProgress(progress) ||
            !validateStatus(status)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid goal details. Check the title, description, target date, progress, and status."
            });
        }

        const cleanDescription =
            description === undefined ||
            description === null ||
            description === ""
                ? null
                : description;

        const cleanTargetDate =
            targetDate === undefined ||
            targetDate === null ||
            targetDate === ""
                ? null
                : targetDate;

        const cleanStatus =
            progress === 100
                ? "completed"
                : status;

        const [result] = await db.execute(
            `UPDATE goals
SET
title = ?,
    description = ?,
    target_date = ?,
    progress = ?,
    status = ?
        WHERE id = ?
            AND user_id = ?`,
            [
                title.trim(),
                cleanDescription,
                cleanTargetDate,
                progress,
                cleanStatus,
                goalId,
                req.userId
            ]
        );

        if (result.affectedRows === 0) {
            const [existingGoals] = await db.execute(
                `SELECT id
                 FROM goals
                 WHERE id = ?
    AND user_id = ?
        LIMIT 1`,
                [
                    goalId,
                    req.userId
                ]
            );

            if (existingGoals.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Goal not found."
                });
            }
        }

        const [goals] = await db.execute(
            `SELECT
id,
    user_id,
    title,
    description,
    target_date,
    progress,
    status,
    created_at,
    updated_at
             FROM goals
             WHERE id = ?
    AND user_id = ?
        LIMIT 1`,
            [
                goalId,
                req.userId
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Goal updated successfully.",
            goal: goals[0]
        });

    } catch (error) {
        console.error(
            "Update goal error:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to update your goal."
        });
    }
});


// ==================================================
// COMPLETE GOAL
// PATCH /api/goals/:id/complete
// ==================================================

router.patch("/:id/complete", async (req, res) => {
    try {
        const goalId = Number(req.params.id);

        if (
            !Number.isSafeInteger(goalId) ||
            goalId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid goal ID."
            });
        }

        const [result] = await db.execute(
            `UPDATE goals
SET
progress = 100,
    status = 'completed'
             WHERE id = ?
    AND user_id = ?`,
            [
                goalId,
                req.userId
            ]
        );

        if (result.affectedRows === 0) {
            const [existingGoals] = await db.execute(
                `SELECT id
                 FROM goals
                 WHERE id = ?
    AND user_id = ?
        LIMIT 1`,
                [
                    goalId,
                    req.userId
                ]
            );

            if (existingGoals.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Goal not found."
                });
            }
        }

        const [goals] = await db.execute(
            `SELECT
id,
    user_id,
    title,
    description,
    target_date,
    progress,
    status,
    created_at,
    updated_at
             FROM goals
             WHERE id = ?
    AND user_id = ?
        LIMIT 1`,
            [
                goalId,
                req.userId
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Congratulations! Your goal is complete.",
            goal: goals[0]
        });

    } catch (error) {
        console.error(
            "Complete goal error:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to complete your goal."
        });
    }
});


// ==================================================
// DELETE GOAL
// DELETE /api/goals/:id
// ==================================================

router.delete("/:id", async (req, res) => {
    try {
        const goalId = Number(req.params.id);

        if (
            !Number.isSafeInteger(goalId) ||
            goalId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid goal ID."
            });
        }

        const [result] = await db.execute(
            `DELETE FROM goals
             WHERE id = ?
    AND user_id = ?`,
            [
                goalId,
                req.userId
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Goal not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Goal deleted successfully."
        });

    } catch (error) {
        console.error(
            "Delete goal error:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to delete your goal."
        });
    }
});


module.exports = router;

