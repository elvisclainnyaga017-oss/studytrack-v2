-- ==================================================
-- STUDYTRACK V2
-- DATABASE SCHEMA
-- ==================================================

USE studytrack_v2;


-- ==================================================
-- 1. USERS TABLE
-- ==================================================

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    full_name VARCHAR(100) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE,

    password_hash VARCHAR(255) NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_users_email_not_empty
        CHECK (CHAR_LENGTH(TRIM(email)) > 0)
);


-- ==================================================
-- 2. GOALS TABLE
-- ==================================================

CREATE TABLE IF NOT EXISTS goals (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id INT UNSIGNED NOT NULL,

    title VARCHAR(150) NOT NULL,

    description TEXT NULL,

    target_date DATE NULL,

    progress TINYINT UNSIGNED NOT NULL DEFAULT 0,

    status ENUM(
        'active',
        'completed'
    ) NOT NULL DEFAULT 'active',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_goals_title_not_empty
        CHECK (CHAR_LENGTH(TRIM(title)) > 0),

    CONSTRAINT chk_goals_progress_range
        CHECK (progress BETWEEN 0 AND 100),

    CONSTRAINT fk_goals_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_goals_user_id (user_id),

    INDEX idx_goals_status (status),

    INDEX idx_goals_target_date (target_date)
);


-- ==================================================
-- 3. VERIFY TABLE CREATION
-- ==================================================

SHOW TABLES;


-- ==================================================
-- 4. VERIFY USERS TABLE
-- ==================================================

DESCRIBE users;


-- ==================================================
-- 5. VERIFY GOALS TABLE
-- ==================================================

DESCRIBE goals;