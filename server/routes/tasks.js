// ==================================================
// STUDYTRACK V2
// TASKS API
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
            message: "Please log in to access your tasks."
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


// Protect every Tasks API endpoint.

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


function validatePriority(priority) {
    return [
        "low",
        "medium",
        "high"
    ].includes(priority);
}


function validateStatus(status) {
    return [
        "pending",
        "in_progress",
        "completed"
    ].includes(status);
}


/**
 * Validate a date-only string in YYYY-MM-DD format.
 *
 * The date is kept as a calendar date rather than
 * converted into a local-time timestamp.
 */
function validateDueDate(dueDate) {
    if (
        dueDate === undefined ||
        dueDate === null ||
        dueDate === ""
    ) {
        return true;
    }

    if (
        typeof dueDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)
    ) {
        return false;
    }

    const parsedDate = new Date(
        `${dueDate}T00:00:00.000Z`
    );

    return (
        !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.toISOString().slice(0, 10) === dueDate
    );
}


/**
 * Validate a task ID from the URL.
 */
function parseTaskId(value) {
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
 * Return a consistent task representation.
 *
 * DATE_FORMAT ensures that due_date is returned as
 * YYYY-MM-DD without a time or timezone conversion.
 */
const TASK_SELECT = `
    SELECT
        id,
        user_id,
        title,
        description,
        DATE_FORMAT(due_date, '%Y-%m-%d') AS due_date,
        priority,
        status,
        created_at,
        updated_at
    FROM tasks
`;


// ==================================================
// GET ALL TASKS
// GET /api/tasks
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
                    message: "Invalid task status."
                });
            }

            conditions.push("status = ?");
            parameters.push(req.query.status);
        }

        // Optional priority filter.
        if (req.query.priority !== undefined) {
            if (!validatePriority(req.query.priority)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid task priority."
                });
            }

            conditions.push("priority = ?");
            parameters.push(req.query.priority);
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

                const searchPattern = `%${search}%`;

                parameters.push(
                    searchPattern,
                    searchPattern
                );
            }
        }

        // Whitelist sorting options.
        const sortOptions = {
            due_date: "due_date IS NULL ASC, due_date ASC, created_at DESC",
            priority: `
                FIELD(priority, 'high', 'medium', 'low') ASC,
                created_at DESC
            `,
            created_at: "created_at DESC",
            updated_at: "updated_at DESC",
            title: "title ASC"
        };

        const requestedSort = req.query.sort || "created_at";

        if (!Object.prototype.hasOwnProperty.call(
            sortOptions,
            requestedSort
        )) {
            return res.status(400).json({
                success: false,
                message: "Invalid task sorting option."
            });
        }

        const sql = `
            ${TASK_SELECT}
            WHERE ${conditions.join(" AND ")}
            ORDER BY ${sortOptions[requestedSort]}
        `;

        const [tasks] = await db.execute(sql, parameters);

        return res.status(200).json({
            success: true,
            count: tasks.length,
            tasks
        });

    } catch (error) {
        console.error(
            "Get tasks failed:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve tasks."
        });
    }
});


// ==================================================
// GET TASK SUMMARY
// GET /api/tasks/summary
// ==================================================

router.get("/summary", async (req, res) => {
    try {
        const [rows] = await db.execute(
            `
                SELECT
                    COUNT(*) AS total_tasks,

                    COALESCE(
                        SUM(status = 'pending'),
                        0
                    ) AS pending_tasks,

                    COALESCE(
                        SUM(status = 'in_progress'),
                        0
                    ) AS in_progress_tasks,

                    COALESCE(
                        SUM(status = 'completed'),
                        0
                    ) AS completed_tasks,

                    COALESCE(
                        SUM(
                            status <> 'completed'
                            AND due_date < CURDATE()
                        ),
                        0
                    ) AS overdue_tasks

                FROM tasks
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
            "Get task summary failed:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve task statistics."
        });
    }
});


// ==================================================
// GET ONE TASK
// GET /api/tasks/:id
// ==================================================

router.get("/:id", async (req, res) => {
    const taskId = parseTaskId(req.params.id);

    if (!taskId) {
        return res.status(400).json({
            success: false,
            message: "Invalid task ID."
        });
    }

    try {
        const [tasks] = await db.execute(
            `
                ${TASK_SELECT}
                WHERE id = ?
                  AND user_id = ?
                LIMIT 1
            `,
            [taskId, req.userId]
        );

        if (tasks.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Task not found."
            });
        }

        return res.status(200).json({
            success: true,
            task: tasks[0]
        });

    } catch (error) {
        console.error(
            "Get task failed:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve the task."
        });
    }
});


// ==================================================
// CREATE TASK
// POST /api/tasks
// ==================================================

router.post("/", async (req, res) => {
    const {
        title,
        description = null,
        due_date = null,
        priority = "medium",
        status = "pending"
    } = req.body || {};

    if (!validateTitle(title)) {
        return res.status(400).json({
            success: false,
            message: "Task title is required and must not exceed 150 characters."
        });
    }

    if (!validateDescription(description)) {
        return res.status(400).json({
            success: false,
            message: "Description must not exceed 10,000 characters."
        });
    }

    if (!validateDueDate(due_date)) {
        return res.status(400).json({
            success: false,
            message: "Due date must be a valid date in YYYY-MM-DD format."
        });
    }

    if (!validatePriority(priority)) {
        return res.status(400).json({
            success: false,
            message: "Priority must be low, medium or high."
        });
    }

    if (!validateStatus(status)) {
        return res.status(400).json({
            success: false,
            message: "Status must be pending, in_progress or completed."
        });
    }

    try {
        const [result] = await db.execute(
            `
                INSERT INTO tasks (
                    user_id,
                    title,
                    description,
                    due_date,
                    priority,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                req.userId,
                title.trim(),
                description === null ? null : description.trim(),
                due_date || null,
                priority,
                status
            ]
        );

        const [tasks] = await db.execute(
            `
                ${TASK_SELECT}
                WHERE id = ?
                  AND user_id = ?
                LIMIT 1
            `,
            [result.insertId, req.userId]
        );

        return res.status(201).json({
            success: true,
            message: "Task created successfully.",
            task: tasks[0]
        });

    } catch (error) {
        console.error(
            "Create task failed:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to create the task."
        });
    }
});


// ==================================================
// UPDATE TASK
// PUT /api/tasks/:id
// ==================================================

router.put("/:id", async (req, res) => {
    const taskId = parseTaskId(req.params.id);

    if (!taskId) {
        return res.status(400).json({
            success: false,
            message: "Invalid task ID."
        });
    }

    const body = req.body || {};

    const {
        title,
        description = null,
        due_date = null,
        priority,
        status
    } = body;

    if (!validateTitle(title)) {
        return res.status(400).json({
            success: false,
            message: "Task title is required and must not exceed 150 characters."
        });
    }

    if (!validateDescription(description)) {
        return res.status(400).json({
            success: false,
            message: "Description must not exceed 10,000 characters."
        });
    }

    if (!validateDueDate(due_date)) {
        return res.status(400).json({
            success: false,
            message: "Due date must be a valid date in YYYY-MM-DD format."
        });
    }

    if (!validatePriority(priority)) {
        return res.status(400).json({
            success: false,
            message: "Priority must be low, medium or high."
        });
    }

    if (!validateStatus(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid task status."
        });
    }

    try {
        const [result] = await db.execute(
            `
                UPDATE tasks
                SET
                    title = ?,
                    description = ?,
                    due_date = ?,
                    priority = ?,
                    status = ?
                WHERE id = ?
                  AND user_id = ?
            `,
            [
                title.trim(),
                description === null ? null : description.trim(),
                due_date || null,
                priority,
                status,
                taskId,
                req.userId
            ]
        );

        if (result.affectedRows === 0) {
            const [existing] = await db.execute(
                `
                    SELECT id
                    FROM tasks
                    WHERE id = ?
                      AND user_id = ?
                    LIMIT 1
                `,
                [taskId, req.userId]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Task not found."
                });
            }
        }

        const [tasks] = await db.execute(
            `
                ${TASK_SELECT}
                WHERE id = ?
                  AND user_id = ?
                LIMIT 1
            `,
            [taskId, req.userId]
        );

        return res.status(200).json({
            success: true,
            message: "Task updated successfully.",
            task: tasks[0]
        });

    } catch (error) {
        console.error(
            "Update task failed:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to update the task."
        });
    }
});


// ==================================================
// UPDATE TASK STATUS
// PATCH /api/tasks/:id/status
// ==================================================

router.patch("/:id/status", async (req, res) => {
    const taskId = parseTaskId(req.params.id);
    const { status } = req.body || {};

    if (!taskId) {
        return res.status(400).json({
            success: false,
            message: "Invalid task ID."
        });
    }

    if (!validateStatus(status)) {
        return res.status(400).json({
            success: false,
            message: "Status must be pending, in_progress or completed."
        });
    }

    try {
        const [result] = await db.execute(
            `
                UPDATE tasks
                SET status = ?
                WHERE id = ?
                  AND user_id = ?
            `,
            [status, taskId, req.userId]
        );

        if (result.affectedRows === 0) {
            const [existing] = await db.execute(
                `
                    SELECT id
                    FROM tasks
                    WHERE id = ?
                      AND user_id = ?
                    LIMIT 1
                `,
                [taskId, req.userId]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Task not found."
                });
            }
        }

        const [tasks] = await db.execute(
            `
                ${TASK_SELECT}
                WHERE id = ?
                  AND user_id = ?
                LIMIT 1
            `,
            [taskId, req.userId]
        );

        return res.status(200).json({
            success: true,
            message: "Task status updated successfully.",
            task: tasks[0]
        });

    } catch (error) {
        console.error(
            "Update task status failed:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to update task status."
        });
    }
});


// ==================================================
// DELETE TASK
// DELETE /api/tasks/:id
// ==================================================

router.delete("/:id", async (req, res) => {
    const taskId = parseTaskId(req.params.id);

    if (!taskId) {
        return res.status(400).json({
            success: false,
            message: "Invalid task ID."
        });
    }

    try {
        const [result] = await db.execute(
            `
                DELETE FROM tasks
                WHERE id = ?
                  AND user_id = ?
            `,
            [taskId, req.userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Task not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Task deleted successfully."
        });

    } catch (error) {
        console.error(
            "Delete task failed:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to delete the task."
        });
    }
});


// ==================================================
// EXPORT ROUTER
// ==================================================

module.exports = router;