"use strict";

// ==================================================
// STUDYTRACK V2
// FOCUS TIMER DATABASE SETUP
// File: server/setup-focus-db.js
//
// Purpose:
// Create the focus_sessions table if it does not exist.
// Existing tables and records will not be modified.
// ==================================================

require("dotenv").config();

const db = require("./db");

async function setupFocusDatabase() {
    let connection;

    try {
        console.log("");
        console.log("========================================");
        console.log("STUDYTRACK V2 - FOCUS TIMER DATABASE");
        console.log("========================================");
        console.log("");

        // Confirm the database connection.
        connection = await db.getConnection();

        const [databaseRows] = await connection.query(
            "SELECT DATABASE() AS database_name"
        );

        console.log(
            "Connected database:",
            databaseRows[0].database_name
        );

        // Create the focus session table if necessary.
        await connection.query(`
            CREATE TABLE IF NOT EXISTS focus_sessions (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

                user_id INT(10) UNSIGNED NOT NULL,

                session_type ENUM(
                    'focus',
                    'short_break',
                    'long_break'
                ) NOT NULL DEFAULT 'focus',

                planned_duration_seconds INT UNSIGNED NOT NULL,

                duration_seconds INT UNSIGNED NOT NULL,

                started_at DATETIME NOT NULL,

                completed_at DATETIME NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

                created_at TIMESTAMP NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

                PRIMARY KEY (id),

                INDEX idx_focus_sessions_user_id (
                    user_id
                ),

                INDEX idx_focus_sessions_user_completed (
                    user_id,
                    completed_at
                ),

                INDEX idx_focus_sessions_user_type (
                    user_id,
                    session_type
                ),

                CONSTRAINT fk_focus_sessions_user
                    FOREIGN KEY (user_id)
                    REFERENCES users (id)
                    ON DELETE CASCADE
                    ON UPDATE CASCADE,

                CONSTRAINT chk_focus_planned_duration
                    CHECK (
                        planned_duration_seconds > 0
                    ),

                CONSTRAINT chk_focus_actual_duration
                    CHECK (
                        duration_seconds > 0
                    )
            ) ENGINE=InnoDB
              DEFAULT CHARSET=utf8mb4
              COLLATE=utf8mb4_unicode_ci
        `);

        console.log("");
        console.log("Focus sessions table is ready.");

        // Display the resulting table structure.
        const [columns] = await connection.query(
            "SHOW COLUMNS FROM focus_sessions"
        );

        console.log("");
        console.log("=== FOCUS SESSIONS TABLE ===");
        console.table(columns);

        console.log("");
        console.log("Database setup completed successfully.");
        console.log("");

    } catch (error) {
        console.error("");
        console.error("FOCUS DATABASE SETUP FAILED");
        console.error(
            "Error:",
            error.code || error.message
        );
        console.error("");

        process.exitCode = 1;

    } finally {
        if (connection) {
            connection.release();
        }

        await db.end();
    }
}

setupFocusDatabase();