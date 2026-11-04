// ==================================================
// STUDYTRACK V2
// AUTHENTICATION RATE LIMITER
// Persistent MySQL storage
// Includes expired-record cleanup
// ==================================================

"use strict";

const crypto = require("crypto");
const db = require("../db");


// ==================================================
// DATABASE CLEANUP CONFIGURATION
// ==================================================

const CLEANUP_AFTER_HOURS = 24;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

// Spread initial cleanup times across the first 15 minutes.

let nextCleanupAt =
    Date.now() + crypto.randomInt(0, 15 * 60 * 1000);

let cleanupInProgress = false;


// ==================================================
// CLEAN UP EXPIRED RATE-LIMIT RECORDS
// ==================================================

async function cleanupExpiredRateLimits() {

    if (
        cleanupInProgress ||
        Date.now() < nextCleanupAt
    ) {
        return;
    }

    cleanupInProgress = true;

    // Schedule the next cleanup before starting this one.

    nextCleanupAt =
        Date.now() +
        CLEANUP_INTERVAL_MS +
        crypto.randomInt(0, 15 * 60 * 1000);

    try {

        await db.execute(
            `DELETE FROM auth_rate_limits
             WHERE updated_at < DATE_SUB(
                 NOW(),
                 INTERVAL ? HOUR
             )`,
            [CLEANUP_AFTER_HOURS]
        );

    } catch (error) {

        // Cleanup failure must not interrupt authentication.

        console.error(
            "Rate-limit cleanup warning:",
            error.code || error.message
        );

    } finally {

        cleanupInProgress = false;

    }
}


// ==================================================
// RATE LIMIT CONFIGURATION
// ==================================================

function createAuthRateLimiter(options) {

    const {
        scope,
        maxAttempts,
        windowSeconds
    } = options;


    if (
        !scope ||
        !Number.isInteger(maxAttempts) ||
        !Number.isInteger(windowSeconds)
    ) {
        throw new Error(
            "Invalid authentication rate limiter configuration."
        );
    }


    if (scope.length > 32) {
        throw new Error(
            "Rate limiter scope cannot exceed 32 characters."
        );
    }


    // Use the existing session secret to hash IP addresses.

    const secret = process.env.SESSION_SECRET;

    if (!secret) {
        throw new Error(
            "SESSION_SECRET is required for authentication rate limiting."
        );
    }


    return async function authRateLimiter(req, res, next) {

        try {

            // Obtain the visitor's IP address.

            const ipAddress =
                req.ip ||
                req.socket?.remoteAddress;


            if (!ipAddress) {
                return res.status(503).json({
                    success: false,
                    message: "Authentication is temporarily unavailable."
                });
            }


            // Hash the IP address.
            // Raw IP addresses are never stored.

            const keyHash = crypto
                .createHmac("sha256", secret)
                .update(`${scope}:${ipAddress}`)
                .digest("hex");


            // Occasionally remove records inactive for 24 hours.

            await cleanupExpiredRateLimits();


            // Atomically create or update the attempt counter.

            await db.execute(
                `INSERT INTO auth_rate_limits
                    (
                        scope,
                        key_hash,
                        window_started_at,
                        attempts,
                        updated_at
                    )
                 VALUES (?, ?, NOW(), 1, NOW())

                 ON DUPLICATE KEY UPDATE

                    attempts = IF(
                        window_started_at <= DATE_SUB(
                            NOW(),
                            INTERVAL ? SECOND
                        ),
                        1,
                        attempts + 1
                    ),

                    window_started_at = IF(
                        window_started_at <= DATE_SUB(
                            NOW(),
                            INTERVAL ? SECOND
                        ),
                        NOW(),
                        window_started_at
                    ),

                    updated_at = NOW()`,

                [
                    scope,
                    keyHash,
                    windowSeconds,
                    windowSeconds
                ]
            );


            // Retrieve the updated attempt count.

            const [rows] = await db.execute(
                `SELECT
                    attempts,

                    GREATEST(
                        1,
                        TIMESTAMPDIFF(
                            SECOND,
                            NOW(),
                            DATE_ADD(
                                window_started_at,
                                INTERVAL ? SECOND
                            )
                        )
                    ) AS retry_after

                 FROM auth_rate_limits

                 WHERE scope = ?
                 AND key_hash = ?

                 LIMIT 1`,

                [
                    windowSeconds,
                    scope,
                    keyHash
                ]
            );


            if (rows.length === 0) {
                throw new Error(
                    "Unable to retrieve authentication rate limit."
                );
            }


            const attempts = Number(rows[0].attempts);

            const retryAfter = Number(rows[0].retry_after);


            // Reject requests exceeding the configured limit.

            if (attempts > maxAttempts) {

                res.set(
                    "Retry-After",
                    String(retryAfter)
                );

                return res.status(429).json({
                    success: false,
                    message: "Too many attempts. Please try again later.",
                    retryAfter
                });
            }


            return next();

        } catch (error) {

            console.error(
                "Authentication rate limiter error:",
                error.code || error.message
            );

            // Fail closed if rate limiting cannot be verified.

            return res.status(503).json({
                success: false,
                message: "Authentication is temporarily unavailable. Please try again shortly."
            });

        }
    };
}


// ==================================================
// EXPORT CONFIGURATIONS
// ==================================================

module.exports = {

    login: createAuthRateLimiter({
        scope: "login",
        maxAttempts: 10,
        windowSeconds: 15 * 60
    }),

    registration: createAuthRateLimiter({
        scope: "registration",
        maxAttempts: 5,
        windowSeconds: 60 * 60
    })

};
