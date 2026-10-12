// ==================================================
// STUDYTRACK V2
// AUTHENTICATION ROUTES
// ==================================================

const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");

const router = express.Router();


// ==================================================
// REGISTER
// POST /api/auth/register
// ==================================================

router.post("/register", async (req, res) => {
    try {
        const fullName =
            typeof req.body.fullName === "string"
                ? req.body.fullName.trim()
                : "";

        const email =
            typeof req.body.email === "string"
                ? req.body.email.trim().toLowerCase()
                : "";

        const password =
            typeof req.body.password === "string"
                ? req.body.password
                : "";


        // Validate required fields.

        if (!fullName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required fields."
            });
        }


        // Validate the name.

        if (fullName.length < 2 || fullName.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Your name must contain between 2 and 100 characters."
            });
        }


        // Basic email validation.

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (
            email.length > 255 ||
            !emailPattern.test(email)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }


        // Validate password length.
        // bcrypt supports a maximum of 72 UTF-8 bytes.

        const passwordBytes =
            Buffer.byteLength(password, "utf8");

        if (passwordBytes < 8 || passwordBytes > 72) {
            return res.status(400).json({
                success: false,
                message: "Your password must contain at least 8 characters and cannot exceed 72 UTF-8 bytes."
            });
        }


        // Hash the password before storing it.

        const passwordHash =
            await bcrypt.hash(password, 12);


        // Save the new account.

        const [result] = await db.execute(
            `INSERT INTO users
                (full_name, email, password_hash)
             VALUES (?, ?, ?)`,
            [fullName, email, passwordHash]
        );


        // Create a session for the new user.

        req.session.regenerate((sessionError) => {
            if (sessionError) {
                console.error(
                    "Session creation failed:",
                    sessionError.message
                );

                return res.status(500).json({
                    success: false,
                    message: "Your account was created, but your session could not be started. Please log in."
                });
            }

            req.session.user = {
                id: result.insertId,
                fullName,
                email
            };

            req.session.save((saveError) => {
                if (saveError) {
                    console.error(
                        "Session save failed:",
                        saveError.message
                    );

                    return res.status(500).json({
                        success: false,
                        message: "Your account was created, but your session could not be saved. Please log in."
                    });
                }

                return res.status(201).json({
                    success: true,
                    message: "Your account has been created successfully.",
                    user: {
                        id: result.insertId,
                        fullName,
                        email
                    }
                });
            });
        });

    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "An account with this email address already exists."
            });
        }

        console.error(
            "Registration error:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Registration failed. Please try again."
        });
    }
});


// ==================================================
// LOGIN
// POST /api/auth/login
// ==================================================

router.post("/login", async (req, res) => {
    try {
        const email =
            typeof req.body.email === "string"
                ? req.body.email.trim().toLowerCase()
                : "";

        const password =
            typeof req.body.password === "string"
                ? req.body.password
                : "";


        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please enter your email and password."
            });
        }


        // Find the account by email.

        const [users] = await db.execute(
            `SELECT
                id,
                full_name,
                email,
                password_hash
             FROM users
             WHERE email = ?
             LIMIT 1`,
            [email]
        );


        // Use the same response for unknown emails
        // and incorrect passwords.

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }


        const user = users[0];

        const passwordMatches =
            await bcrypt.compare(
                password,
                user.password_hash
            );


        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }


        // Replace the old session after authentication.

        req.session.regenerate((sessionError) => {
            if (sessionError) {
                console.error(
                    "Session regeneration failed:",
                    sessionError.message
                );

                return res.status(500).json({
                    success: false,
                    message: "Unable to start your session. Please try again."
                });
            }

            req.session.user = {
                id: user.id,
                fullName: user.full_name,
                email: user.email
            };

            req.session.save((saveError) => {
                if (saveError) {
                    console.error(
                        "Login session save failed:",
                        saveError.message
                    );

                    return res.status(500).json({
                        success: false,
                        message: "Unable to save your session. Please try again."
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "Login successful.",
                    user: {
                        id: user.id,
                        fullName: user.full_name,
                        email: user.email
                    }
                });
            });
        });

    } catch (error) {
        console.error(
            "Login error:",
            error.code || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Login failed. Please try again."
        });
    }
});


// ==================================================
// CHECK CURRENT SESSION
// GET /api/auth/me
// ==================================================

router.get("/me", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            authenticated: false,
            message: "You are not logged in."
        });
    }

    return res.status(200).json({
        success: true,
        authenticated: true,
        user: req.session.user
    });
});


// ==================================================
// LOGOUT
// POST /api/auth/logout
// ==================================================

router.post("/logout", (req, res) => {
    if (!req.session) {
        return res.status(200).json({
            success: true,
            message: "You have been logged out."
        });
    }

    req.session.destroy((error) => {
        if (error) {
            console.error(
                "Logout error:",
                error.message
            );

            return res.status(500).json({
                success: false,
                message: "Unable to log out. Please try again."
            });
        }

        res.clearCookie("connect.sid");

        return res.status(200).json({
            success: true,
            message: "You have been logged out successfully."
        });
    });
});


module.exports = router;