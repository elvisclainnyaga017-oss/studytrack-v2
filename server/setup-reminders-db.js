// ==================================================
// STUDYTRACK V2
// REMINDERS DATABASE SETUP
// File: server/setup-reminders-db.js
// ==================================================

"use strict";

require("dotenv").config();

const db = require("./db");


// ==================================================
// CREATE REMINDERS TABLE
// ==================================================

async function setupRemindersDatabase() {
    let connection;

    console.log("");
    console.log("====================================");
    console.log("STUDYTRACK V2 - REMINDERS DATABASE SETUP");
    console.log("====================================");
    console.log("");

    try {
        connection = await db.getConnection();

        // Confirm the configured database.
        const [databaseRows] = await connection.query(
            "SELECT DATABASE() AS database_name"
        );

        const databaseName = databaseRows[0].database_name;

        if (databaseName !== "studytrack_v2") {
            throw new Error(
                `Unexpected database: ${databaseName}. ` +
                "Expected studytrack_v2. No changes were made."
            );
        }

        console.log(`Database: ${databaseName}`);

        // Create the Reminders table if it does not exist.
        await connection.query(`
            CREATE TABLE IF NOT EXISTS reminders (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

                user_id INT UNSIGNED NOT NULL,

                title VARCHAR(150) NOT NULL,

                description TEXT NULL,

                remind_at DATETIME NOT NULL,

                status ENUM(
                    'pending',
                    'completed'
                ) NOT NULL DEFAULT 'pending',

                created_at TIMESTAMP NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP NOT NULL
                    DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,

                CONSTRAINT chk_reminders_title_not_empty
                    CHECK (
                        CHAR_LENGTH(TRIM(title)) > 0
                    ),

                CONSTRAINT fk_reminders_user
                    FOREIGN KEY (user_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                INDEX idx_reminders_user_id (
                    user_id
                ),

                INDEX idx_reminders_remind_at (
                    remind_at
                ),

                INDEX idx_reminders_status (
                    status
                ),

                INDEX idx_reminders_user_status (
                    user_id,
                    status
                ),

                INDEX idx_reminders_user_remind_at (
                    user_id,
                    remind_at
                )
            )
        `);

        console.log(
            "Reminders table created or already exists."
        );

        // Verify the table structure.
        const [columns] = await connection.query(
            "DESCRIBE reminders"
        );

        console.log("");
        console.log("REMINDERS TABLE STRUCTURE");
        console.log("");

        console.table(columns);

        // Verify the table exists.
        const [tables] = await connection.query(
            "SHOW TABLES LIKE 'reminders'"
        );

        if (tables.length !== 1) {
            throw new Error(
                "Reminders table verification failed."
            );
        }

        console.log("");
        console.log(
            "SUCCESS: Reminders database is ready."
        );
        console.log("");

    } catch (error) {
        console.error("");
        console.error(
            "REMINDERS DATABASE SETUP FAILED"
        );

        console.error(
            "Error code:",
            error.code || "UNKNOWN"
        );

        console.error(
            "Error message:",
            error.message
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


// ==================================================
// RUN DATABASE SETUP
// ==================================================

setupRemindersDatabase();