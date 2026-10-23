// ==================================================
// STUDYTRACK V2
// EXPRESS SERVER
// ==================================================

require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");

const db = require("./db");

const authRoutes = require("./routes/auth");
const goalsRoutes = require("./routes/goals");
const habitsRoutes = require("./routes/habits");
const tasksRoutes = require("./routes/tasks");

const app = express();


// ==================================================
// SERVER CONFIGURATION
// ==================================================

const PORT = Number(process.env.PORT) || 3001;


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
        "SESSION_SECRET is missing from the .env file."
    );
}

app.use(session({
    name: "connect.sid",

    secret: process.env.SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000
    }
}));


// ==================================================
// SERVE FRONTEND FILES
// ==================================================

app.use(express.static(
    path.join(__dirname, "..", "public")
));


// ==================================================
// HEALTH CHECK
// GET /api/health
// ==================================================

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "StudyTrack V2 server is running."
    });
});


// ==================================================
// DATABASE STATUS
// GET /api/database-status
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
// AUTHENTICATION ROUTES
// ==================================================

app.use("/api/auth", authRoutes);


// ==================================================
// GOALS ROUTES
// ==================================================

app.use("/api/goals", goalsRoutes);


// ==================================================
// HABITS ROUTES
// ==================================================

app.use("/api/habits", habitsRoutes);


// ==================================================
// TASKS ROUTES
// ==================================================

app.use("/api/tasks", tasksRoutes);


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
// START SERVER
// ==================================================

async function startServer() {
    let connection;

    try {
        connection = await db.getConnection();

        connection.release();
        connection = null;

        const server = app.listen(PORT, () => {
            console.log("");
            console.log("====================================");
            console.log("STUDYTRACK V2");
            console.log("====================================");
            console.log(`Server: http://localhost:${PORT}`);
            console.log("Database: Connected");
            console.log("Authentication routes: Ready");
            console.log("Goals routes: Ready");
            console.log("Habits routes: Ready");
            console.log("Tasks routes: Ready");
            console.log("====================================");
            console.log("");
        });

        async function shutdown() {
            console.log("\nShutting down StudyTrack V2...");

            server.close(async () => {
                try {
                    await db.end();

                    console.log("Server stopped successfully.");

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
        console.error("Error code:", error.code || "UNKNOWN");
        console.error("Check your database configuration.");
        console.error("");

        await db.end();

        process.exitCode = 1;
    }
}


// ==================================================
// RUN APPLICATION
// ==================================================

startServer();