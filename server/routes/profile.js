// ==================================================
// STUDYTRACK V2
// PROFILE API ROUTES
// File: server/routes/profile.js
//
// Features:
// - Retrieve authenticated user's profile.
// - Update full name, username and biography.
// - Change account password securely.
// - Upload and replace profile pictures using Vercel Blob.
// - Remove profile pictures from Vercel Blob or legacy local storage.
// - Validate uploaded image file types and signatures.
// - Keep profile information private to its owner.
// ==================================================

const express = require("express");
const bcrypt = require("bcrypt");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const db = require("../db");

const router = express.Router();


// ==================================================
// CONFIGURATION
// ==================================================

const BCRYPT_ROUNDS = 12;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

const MAX_USERNAME_LENGTH = 50;
const MAX_BIO_LENGTH = 500;

// Maximum profile picture size: 4 MB.
const MAX_PROFILE_PICTURE_SIZE = 4 * 1024 * 1024;

// Retained for safe cleanup of older locally stored pictures.
const UPLOAD_DIRECTORY = path.join(
    __dirname,
    "..",
    "..",
    "public",
    "uploads",
    "profile-pictures"
);

const ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
};

// Only URLs belonging to this StudyTrack Blob store can be deleted.
const BLOB_PUBLIC_HOST =
    "29edoouxz0ftqync.public.blob.vercel-storage.com";


// ==================================================
// AUTHENTICATION MIDDLEWARE
// ==================================================

function requireAuthentication(req, res, next) {
    const userId = Number(req.session?.user?.id);

    if (
        !req.session?.user ||
        !Number.isSafeInteger(userId) ||
        userId <= 0
    ) {
        return res.status(401).json({
            success: false,
            message: "Please log in to access your profile."
        });
    }

    req.userId = userId;

    next();
}

router.use(requireAuthentication);


// ==================================================
// MULTER CONFIGURATION
// ==================================================

// Store uploaded image data in memory.
// Vercel Blob receives the image directly from this buffer.
const storage = multer.memoryStorage();

const upload = multer({
    storage,

    limits: {
        fileSize: MAX_PROFILE_PICTURE_SIZE,
        files: 1
    },

    fileFilter: (req, file, callback) => {
        if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
            return callback(
                new Error(
                    "Only JPG, PNG and WEBP images are allowed."
                )
            );
        }

        callback(null, true);
    }
});


// ==================================================
// VALIDATION HELPERS
// ==================================================

function isValidString(value, maximumLength) {
    return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.trim().length <= maximumLength
    );
}


function isValidUsername(value) {
    if (value === null || value === "") {
        return true;
    }

    if (
        typeof value !== "string" ||
        value.length > MAX_USERNAME_LENGTH
    ) {
        return false;
    }

    return /^[a-zA-Z0-9_.-]{3,50}$/.test(value);
}


function isValidBiography(value) {
    return (
        typeof value === "string" &&
        value.length <= MAX_BIO_LENGTH
    );
}


function isValidPassword(value) {
    return (
        typeof value === "string" &&
        value.length >= MIN_PASSWORD_LENGTH &&
        Buffer.byteLength(value, "utf8") <= MAX_PASSWORD_BYTES
    );
}


// ==================================================
// IMAGE SIGNATURE VALIDATION
// ==================================================

function identifyImage(buffer) {
    if (
        !Buffer.isBuffer(buffer) ||
        buffer.length < 12
    ) {
        return null;
    }

    // JPEG signature
    if (
        buffer[0] === 0xFF &&
        buffer[1] === 0xD8 &&
        buffer[2] === 0xFF
    ) {
        return "jpg";
    }

    // PNG signature
    if (
        buffer.subarray(0, 8).equals(
            Buffer.from([
                0x89,
                0x50,
                0x4E,
                0x47,
                0x0D,
                0x0A,
                0x1A,
                0x0A
            ])
        )
    ) {
        return "png";
    }

    // WEBP signature
    if (
        buffer.toString("ascii", 0, 4) === "RIFF" &&
        buffer.toString("ascii", 8, 12) === "WEBP"
    ) {
        return "webp";
    }

    return null;
}


// ==================================================
// LEGACY LOCAL PROFILE IMAGE HELPERS
// ==================================================

function getSafeProfilePicturePath(imagePath) {
    if (
        typeof imagePath !== "string" ||
        !imagePath.startsWith("/uploads/profile-pictures/")
    ) {
        return null;
    }

    const filename = imagePath.split("/").pop();

    if (
        !filename ||
        !/^[a-f0-9-]+\.(jpg|png|webp)$/i.test(filename)
    ) {
        return null;
    }

    const resolvedPath = path.resolve(
        UPLOAD_DIRECTORY,
        filename
    );

    if (
        path.dirname(resolvedPath) !==
        path.resolve(UPLOAD_DIRECTORY)
    ) {
        return null;
    }

    return resolvedPath;
}


// ==================================================
// VERCEL BLOB HELPERS
// ==================================================

async function uploadProfilePictureToBlob(
    userId,
    imageBuffer,
    imageType,
    contentType
) {
    const { put } = await import("@vercel/blob");

    const filename =
        `${crypto.randomUUID()}.${imageType}`;

    const pathname =
        `profiles/${userId}/${filename}`;

    const blob = await put(
        pathname,
        imageBuffer,
        {
            access: "public",
            contentType,
            addRandomSuffix: false
        }
    );

    return blob.url;
}


async function deleteBlobProfilePicture(imageUrl) {
    if (typeof imageUrl !== "string") {
        return;
    }

    let parsedUrl;

    try {
        parsedUrl = new URL(imageUrl);
    } catch (error) {
        return;
    }

    // Do not delete URLs from other domains or storage providers.
    if (
        parsedUrl.protocol !== "https:" ||
        parsedUrl.hostname !== BLOB_PUBLIC_HOST ||
        !parsedUrl.pathname.startsWith("/profiles/")
    ) {
        return;
    }

    const { del } = await import("@vercel/blob");

    await del(imageUrl);
}


// ==================================================
// DELETE PROFILE PICTURE HELPER
// ==================================================

async function deleteProfilePicture(imagePath) {
    if (typeof imagePath !== "string" || !imagePath) {
        return;
    }

    // Support pictures uploaded before the Vercel Blob migration.
    const safePath = getSafeProfilePicturePath(imagePath);

    if (safePath) {
        try {
            await fs.promises.unlink(safePath);
        } catch (error) {
            if (error.code !== "ENOENT") {
                console.error(
                    "StudyTrack: Unable to delete old local profile picture:",
                    error.message
                );
            }
        }

        return;
    }

    // New pictures are stored as full Vercel Blob URLs.
    try {
        await deleteBlobProfilePicture(imagePath);
    } catch (error) {
        console.error(
            "StudyTrack: Unable to delete old Blob profile picture:",
            error.message
        );
    }
}


// ==================================================
// ERROR HANDLER
// ==================================================

function handleProfileError(res, error, message) {
    console.error(
        "StudyTrack Profile API error:",
        error.code || error.message
    );

    if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
            success: false,
            message: "That username is already being used. Please choose another."
        });
    }

    return res.status(500).json({
        success: false,
        message
    });
}


// ==================================================
// UPLOAD ERROR HANDLER
// ==================================================

function handleUploadError(error, req, res, next) {
    if (!error) {
        return next();
    }

    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "Your profile picture cannot exceed 4 MB."
            });
        }

        return res.status(400).json({
            success: false,
            message: "The image upload could not be completed."
        });
    }

    if (error.message?.includes("Only JPG")) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    return res.status(400).json({
        success: false,
        message: "Unable to process the uploaded image."
    });
}


// ==================================================
// GET USER PROFILE
// GET /api/profile
// ==================================================

router.get("/", async (req, res) => {
    try {
        const [rows] = await db.execute(
            `
            SELECT
                u.id,
                u.full_name,
                u.email,
                u.created_at,
                p.username,
                p.bio,
                p.profile_picture,
                p.created_at AS profile_created_at,
                p.updated_at AS profile_updated_at
            FROM users AS u
            LEFT JOIN profiles AS p
                ON p.user_id = u.id
            WHERE u.id = ?
            LIMIT 1
            `,
            [req.userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Your account could not be found."
            });
        }

        const user = rows[0];

        return res.status(200).json({
            success: true,

            profile: {
                id: Number(user.id),
                fullName: user.full_name,
                email: user.email,
                username: user.username,
                bio: user.bio,
                profilePicture: user.profile_picture,
                createdAt: user.created_at,
                profileUpdatedAt: user.profile_updated_at
            }
        });

    } catch (error) {
        return handleProfileError(
            res,
            error,
            "Unable to load your profile."
        );
    }
});


// ==================================================
// UPDATE USER PROFILE
// PUT /api/profile
// ==================================================

router.put("/", async (req, res) => {
    let connection;
    let transactionStarted = false;

    try {
        const {
            fullName,
            username,
            bio
        } = req.body || {};

        if (!isValidString(fullName, 100)) {
            return res.status(400).json({
                success: false,
                message: "Your full name must contain between 1 and 100 characters."
            });
        }

        const cleanUsername =
            typeof username === "string"
                ? username.trim()
                : username;

        if (!isValidUsername(cleanUsername)) {
            return res.status(400).json({
                success: false,
                message: "Username must contain 3–50 characters and use only letters, numbers, dots, underscores or hyphens."
            });
        }

        if (
            bio !== undefined &&
            !isValidBiography(bio)
        ) {
            return res.status(400).json({
                success: false,
                message: "Your biography cannot exceed 500 characters."
            });
        }

        const cleanFullName = fullName.trim();

        const cleanBio =
            typeof bio === "string"
                ? bio.trim()
                : "";

        const normalizedUsername =
            cleanUsername === null || cleanUsername === ""
                ? null
                : cleanUsername;

        connection = await db.getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        const [userRows] = await connection.execute(
            `
            SELECT id
            FROM users
            WHERE id = ?
            LIMIT 1
            `,
            [req.userId]
        );

        if (userRows.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(404).json({
                success: false,
                message: "Your account could not be found."
            });
        }

        await connection.execute(
            `
            UPDATE users
            SET full_name = ?
            WHERE id = ?
            `,
            [
                cleanFullName,
                req.userId
            ]
        );

        await connection.execute(
            `
            INSERT INTO profiles (
                user_id,
                username,
                bio
            )
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                username = VALUES(username),
                bio = VALUES(bio)
            `,
            [
                req.userId,
                normalizedUsername,
                cleanBio
            ]
        );

        await connection.commit();
        transactionStarted = false;

        if (req.session.user) {
            req.session.user.fullName = cleanFullName;
        }

        return res.status(200).json({
            success: true,
            message: "Your profile has been updated successfully.",

            profile: {
                fullName: cleanFullName,
                username: normalizedUsername,
                bio: cleanBio
            }
        });

    } catch (error) {
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    "StudyTrack profile rollback error:",
                    rollbackError.message
                );
            }
        }

        return handleProfileError(
            res,
            error,
            "Unable to update your profile."
        );

    } finally {
        if (connection) {
            connection.release();
        }
    }
});


// ==================================================
// UPLOAD PROFILE PICTURE
// POST /api/profile/picture
//
// FormData field:
// profilePicture
//
// Allowed: JPG, PNG, WEBP
// Maximum size: 4 MB
// Storage: Vercel Blob
// ==================================================

router.post(
    "/picture",
    upload.single("profilePicture"),
    handleUploadError,
    async (req, res) => {
        let uploadedImageUrl = null;
        let databaseUpdated = false;

        try {
            if (!req.file || !req.file.buffer) {
                return res.status(400).json({
                    success: false,
                    message: "Please select a profile picture first."
                });
            }

            // Validate the actual image contents.
            const imageType = identifyImage(req.file.buffer);

            if (!imageType) {
                return res.status(400).json({
                    success: false,
                    message: "The selected file is not a valid JPG, PNG or WEBP image."
                });
            }

            // Confirm the file contents match the declared MIME type.
            const extensionFromMime =
                ALLOWED_IMAGE_TYPES[req.file.mimetype];

            if (imageType !== extensionFromMime) {
                return res.status(400).json({
                    success: false,
                    message: "The image file type does not match its contents."
                });
            }

            // Retrieve the user's current profile picture.
            const [existingRows] = await db.execute(
                `
                SELECT profile_picture
                FROM profiles
                WHERE user_id = ?
                LIMIT 1
                `,
                [req.userId]
            );

            const oldImage =
                existingRows[0]?.profile_picture || null;

            // Upload the new image to Vercel Blob.
            uploadedImageUrl = await uploadProfilePictureToBlob(
                req.userId,
                req.file.buffer,
                imageType,
                req.file.mimetype
            );

            if (!uploadedImageUrl) {
                throw new Error(
                    "Vercel Blob did not return an image URL."
                );
            }

            // Save the permanent Blob URL in the database.
            await db.execute(
                `
                INSERT INTO profiles (
                    user_id,
                    profile_picture
                )
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE
                    profile_picture = VALUES(profile_picture)
                `,
                [
                    req.userId,
                    uploadedImageUrl
                ]
            );

            databaseUpdated = true;

            // Remove the previous image only after the new URL is saved.
            if (
                oldImage &&
                oldImage !== uploadedImageUrl
            ) {
                await deleteProfilePicture(oldImage);
            }

            return res.status(200).json({
                success: true,
                message: "Your profile picture has been uploaded successfully.",
                profilePicture: uploadedImageUrl
            });

        } catch (error) {
            // If the upload succeeded but the database update failed,
            // remove the newly uploaded Blob to avoid an orphaned file.
            if (
                uploadedImageUrl &&
                !databaseUpdated
            ) {
                await deleteProfilePicture(uploadedImageUrl);
            }

            return handleProfileError(
                res,
                error,
                "Unable to upload your profile picture."
            );
        }
    }
);


// ==================================================
// REMOVE PROFILE PICTURE
// DELETE /api/profile/picture
// ==================================================

router.delete("/picture", async (req, res) => {
    try {
        const [rows] = await db.execute(
            `
            SELECT profile_picture
            FROM profiles
            WHERE user_id = ?
            LIMIT 1
            `,
            [req.userId]
        );

        if (rows.length === 0 || !rows[0].profile_picture) {
            return res.status(200).json({
                success: true,
                message: "You do not currently have a profile picture.",
                profilePicture: null
            });
        }

        const oldImage = rows[0].profile_picture;

        // Remove the picture reference from the database first.
        await db.execute(
            `
            UPDATE profiles
            SET profile_picture = NULL
            WHERE user_id = ?
            `,
            [req.userId]
        );

        // Remove the old Blob or legacy local image.
        await deleteProfilePicture(oldImage);

        return res.status(200).json({
            success: true,
            message: "Your profile picture has been removed.",
            profilePicture: null
        });

    } catch (error) {
        return handleProfileError(
            res,
            error,
            "Unable to remove your profile picture."
        );
    }
});


// ==================================================
// CHANGE ACCOUNT PASSWORD
// PATCH /api/profile/password
// ==================================================

router.patch("/password", async (req, res) => {
    try {
        const {
            currentPassword,
            newPassword
        } = req.body || {};

        if (
            typeof currentPassword !== "string" ||
            currentPassword.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Please enter your current password."
            });
        }

        if (!isValidPassword(newPassword)) {
            return res.status(400).json({
                success: false,
                message: "Your new password must contain at least 8 characters and cannot exceed 72 UTF-8 bytes."
            });
        }

        if (currentPassword === newPassword) {
            return res.status(400).json({
                success: false,
                message: "Your new password must be different from your current password."
            });
        }

        const [rows] = await db.execute(
            `
            SELECT password_hash
            FROM users
            WHERE id = ?
            LIMIT 1
            `,
            [req.userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Your account could not be found."
            });
        }

        const passwordMatches = await bcrypt.compare(
            currentPassword,
            rows[0].password_hash
        );

        if (!passwordMatches) {
            return res.status(400).json({
                success: false,
                message: "Your current password is incorrect."
            });
        }

        const newPasswordHash = await bcrypt.hash(
            newPassword,
            BCRYPT_ROUNDS
        );

        const [updateResult] = await db.execute(
            `
            UPDATE users
            SET password_hash = ?
            WHERE id = ?
            `,
            [
                newPasswordHash,
                req.userId
            ]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Your account could not be found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Your password has been changed successfully."
        });

    } catch (error) {
        return handleProfileError(
            res,
            error,
            "Unable to change your password."
        );
    }
});


// ==================================================
// EXPORT ROUTER
// ==================================================

module.exports = router;