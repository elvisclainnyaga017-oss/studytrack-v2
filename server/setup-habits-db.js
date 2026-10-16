// ==================================================
// STUDYTRACK V2
// HABITS DATABASE SETUP
// ==================================================

require("dotenv").config();

const db = require("./db");

async function setupHabitsDatabase() {
    try {
        console.log("");
        console.log("====================================");
        console.log("STUDYTRACK V2 - HABITS DB SETUP");
        console.log("====================================");

        // ------------------------------------------
        // CREATE HABITS TABLE
        // ------------------------------------------

        await db.query(`
            CREATE TABLE IF NOT EXISTS habits(
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT DEFAULT NULL,
    frequency ENUM(
        'daily',
        'weekdays',
        'weekly'
    ) NOT NULL DEFAULT 'daily',
    start_date DATE NOT NULL DEFAULT(CURRENT_DATE),
    status ENUM(
        'active',
        'archived'
    ) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL
                    DEFAULT CURRENT_TIMESTAMP
                    ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY(id),

    KEY idx_habits_user_id(user_id),
    KEY idx_habits_status(status),

    CONSTRAINT fk_habits_user
                    FOREIGN KEY(user_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE,

    CONSTRAINT chk_habits_title_not_empty
                    CHECK(CHAR_LENGTH(TRIM(title)) > 0)
) ENGINE = InnoDB
              DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci
    `);

        console.log("Habits table: ready.");

        // ------------------------------------------
        // CREATE HABIT RECORDS TABLE
        // ------------------------------------------

        await db.query(`
            CREATE TABLE IF NOT EXISTS habit_records(
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        habit_id INT UNSIGNED NOT NULL,
        completion_date DATE NOT NULL,
        created_at TIMESTAMP NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY(id),

        UNIQUE KEY uq_habit_completion_date(
            habit_id,
            completion_date
        ),

        KEY idx_habit_records_date(
            completion_date
        ),

        CONSTRAINT fk_habit_records_habit
                    FOREIGN KEY(habit_id)
                    REFERENCES habits(id)
                    ON DELETE CASCADE
    ) ENGINE = InnoDB
              DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_unicode_ci
    `);

        console.log("Habit records table: ready.");

        // ------------------------------------------
        // VERIFY TABLES
        // ------------------------------------------

        const [tables] = await db.query("SHOW TABLES");

        console.log("");
        console.log("Database tables:");
        console.table(tables);

        console.log("");
        console.log("Habits database setup completed.");
        console.log("");

    } catch (error) {
        console.error("");
        console.error("HABITS DATABASE SETUP FAILED");
        console.error("Error code:", error.code || "UNKNOWN");
        console.error("Message:", error.message);
        process.exitCode = 1;

    } finally {
        await db.end();
    }
}

setupHabitsDatabase();

