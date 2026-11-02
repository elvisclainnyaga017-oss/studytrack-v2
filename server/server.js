"use strict";

// ==================================================
// STUDYTRACK V2
// EXPRESS SERVER
// File: server/server.js
// Supports:
// - Local development
// - Vercel deployment
// - Persistent MySQL-backed sessions
// ==================================================

// ==================================================
// ENVIRONMENT CONFIGURATION
// ==================================================

const path = require("path");
const dotenv = require("dotenv");

// Load the main environment configuration first.
// Existing database and session settings are preserved.
dotenv.config({
    path: path.resolve(__dirname, "..", ".env")
});

// Load Vercel/local development variables.
// Existing variables are NOT overwritten.
dotenv.config({
    path: path.resolve(__dirname, "..", ".env.local"),
    override: false
});

const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);

const db = require("./db");

// ROUTES
const authRoutes = require("./routes/auth");
const goalsRoutes = require("./routes/goals");
const habitsRoutes = require("./routes/habits");
const tasksRoutes = require("./routes/tasks");
const remindersRoutes = require("./routes/reminders");
const focusRoutes = require("./routes/focus");
const profileRoutes = require("./routes/profile");

// CREATE EXPRESS APPLICATION
const app = express();

// SERVER CONFIGURATION
const PORT = Number(process.env.PORT) || 3001;

const isProduction = process.env.NODE_ENV === "production";

// TRUST VERCEL'S HTTPS PROXY
if (isProduction) {
    app.set("trust proxy", 1);
}

// ==================================================
// MIDDLEWARE
// ==================================================

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

// ==================================================
// SESSION CONFIGURATION
// ==================================================

if (!process.env.SESSION_SECRET) {
    throw new Error(
        "SESSION_SECRET environment variable is missing."
    );
}

// Persistent MySQL session store.
// Reuses the existing database pool, including its SSL settings.

const sessionStore = new MySQLStore(
    {
        clearExpired: true,

        checkExpirationInterval: 15 * 60 * 1000,

        expiration: 24 * 60 * 60 * 1000,

        createDatabaseTable: true,

        endConnectionOnClose: false,

        schema: {
            tableName: "sessions",

            columnNames: {
                session_id: "session_id",
                expires: "expires",
                data: "data"
            }
        }
    },
    db
);

app.use(session({
    name: "connect.sid",

    secret: process.env.SESSION_SECRET,

    store: sessionStore,

    resave: false,

    saveUninitialized: false,

    cookie: {
        httpOnly: true,

        secure: isProduction,

        sameSite: "lax",

        maxAge: 24 * 60 * 60 * 1000
    }
}));

// ==================================================
// SERVE FRONTEND FILES LOCALLY
// ==================================================

// Vercel serves files inside public/ through its CDN.
// This middleware remains useful for local development.

app.use(express.static(
    path.join(__dirname, "..", "public")
));

// ==================================================
// HEALTH CHECK
// ==================================================

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "StudyTrack V2 server is running."
    });
});

// ==================================================
// DATABASE STATUS
// ==================================================

app.get("/api/database-status", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                DATABASE() AS database_name,
                @@port AS database_port
        `);

        res.status(200).json({
            success: true,

            message: "Database connection successful.",

            database: rows[0].database_name,

            port: rows[0].database_port
        });

    } catch (error) {
        console.error(
            "Database status check failed:",
            error.code || error.message
        );

        res.status(500).json({
            success: false,

            message: "Unable to connect to the database."
        });
    }
});

// ==================================================
// APPLICATION ROUTES
// ==================================================

app.use("/api/auth", authRoutes);

app.use("/api/goals", goalsRoutes);

app.use("/api/habits", habitsRoutes);

app.use("/api/tasks", tasksRoutes);

app.use("/api/reminders", remindersRoutes);

app.use("/api/focus", focusRoutes);

app.use("/api/profile", profileRoutes);

// ==================================================
// HANDLE UNKNOWN API ROUTES
// ==================================================

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,

        message: "API endpoint not found."
    });
});

// ==================================================
// LOCAL SERVER STARTUP
// ==================================================

async function startServer() {
    let connection;

    try {
        // Verify database connection before starting locally.
        connection = await db.getConnection();

        connection.release();

        connection = null;

        // Wait until the persistent session store is ready.
        await sessionStore.onReady();

        console.log("MySQL session store: Ready");

        const server = app.listen(PORT, () => {
            console.log("");

            console.log("====================================");

            console.log("STUDYTRACK V2");

            console.log("====================================");

            console.log(`Server: http://localhost:${PORT}`);

            console.log("Database: Connected");

            console.log("Sessions: MySQL-backed");

            console.log("Authentication routes: Ready");

            console.log("Goals routes: Ready");

            console.log("Habits routes: Ready");

            console.log("Tasks routes: Ready");

            console.log("Reminders routes: Ready");

            console.log("Focus Timer routes: Ready");

            console.log("Profile routes: Ready");

            console.log("====================================");

            console.log("");
        });

        // GRACEFUL SHUTDOWN
        async function shutdown() {
            console.log(
                "\nShutting down StudyTrack V2..."
            );

            server.close(async () => {
                try {
                    await sessionStore.close();

                    await db.end();

                    console.log(
                        "Server stopped successfully."
                    );

                    process.exit(0);

                } catch (error) {
                    console.error(
                        "Shutdown error:",
                        error.message
                    );

                    process.exit(1);
                }
            });
        }

        process.once("SIGINT", shutdown);

        process.once("SIGTERM", shutdown);

    } catch (error) {
        if (connection) {
            connection.release();
        }

        console.error("");

        console.error("STUDYTRACK V2 FAILED TO START");

        console.error(
            "Error code:",
            error.code || "UNKNOWN"
        );

        console.error(
            "Error message:",
            error.message
        );

        console.error(
            "Check your database and session store configuration."
        );

        console.error("");

        await sessionStore.close().catch(() => { });

        await db.end();

        process.exitCode = 1;
    }
}

// ==================================================
// START LOCALLY ONLY WHEN RUN DIRECTLY
// ==================================================

// Vercel imports this file as an application.
// It must not start a separate listening server there.

if (require.main === module) {
    startServer();
}

// ==================================================
// EXPORT EXPRESS APPLICATION
// ==================================================

module.exports = app;