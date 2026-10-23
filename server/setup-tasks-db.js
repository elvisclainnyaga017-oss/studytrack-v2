// ==================================================
// STUDYTRACK V2
// TASKS DATABASE SETUP
// ==================================================

require("dotenv").config();

const db = require("./db");


// ==================================================
// CREATE TASKS TABLE
// ==================================================

async function setupTasksDatabase() {
    console.log("");
    console.log("====================================");
    console.log("STUDYTRACK V2 - TASKS DATABASE SETUP");
    console.log("====================================");
    console.log("");

    try {
        // Confirm the configured database.
        const [databaseRows] = await db.query(
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

        // Create the Tasks table if it does not exist.
        await db.query(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

                user_id INT UNSIGNED NOT NULL,

                title VARCHAR(150) NOT NULL,

                description TEXT NULL,

                due_date DATE NULL,

                priority ENUM(
                    'low',
                    'medium',
                    'high'
                ) NOT NULL DEFAULT 'medium',

                status ENUM(
                    'pending',
                    'in_progress',
                    'completed'
                ) NOT NULL DEFAULT 'pending',

                created_at TIMESTAMP NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP NOT NULL
                    DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,

                CONSTRAINT chk_tasks_title_not_empty
                    CHECK (
                        CHAR_LENGTH(TRIM(title)) > 0
                    ),

                CONSTRAINT fk_tasks_user
                    FOREIGN KEY (user_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                INDEX idx_tasks_user_id (user_id),

                INDEX idx_tasks_status (status),

                INDEX idx_tasks_priority (priority),

                INDEX idx_tasks_due_date (due_date),

                INDEX idx_tasks_user_status (
                    user_id,
                    status
                )
            )
        `);

        console.log("Tasks table created or already exists.");

        // Verify the table structure.
        const [columns] = await db.query(
            "DESCRIBE tasks"
        );

        console.log("");
        console.log("TASKS TABLE STRUCTURE");
        console.log("");

        console.table(columns);

        // Verify the table exists.
        const [tables] = await db.query(
            "SHOW TABLES LIKE 'tasks'"
        );

        if (tables.length !== 1) {
            throw new Error(
                "Tasks table verification failed."
            );
        }

        console.log("");
        console.log("SUCCESS: Tasks database is ready.");
        console.log("");

    } catch (error) {
        console.error("");
        console.error("TASKS DATABASE SETUP FAILED");
        console.error(error.message);
        console.error("");

        process.exitCode = 1;

    } finally {
        await db.end();
    }
}


// ==================================================
// RUN DATABASE SETUP
// ==================================================

setupTasksDatabase();