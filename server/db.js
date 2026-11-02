// ==================================================
// STUDYTRACK V2
// DATABASE CONNECTION
// Supports local MariaDB and production Aiven MySQL
// ==================================================

"use strict";

const mysql = require("mysql2/promise");
const fs = require("fs");
const dotenv = require("dotenv");

// Load local environment variables.
// Vercel provides production variables directly.
dotenv.config();


// ==================================================
// DATABASE CONFIGURATION
// ==================================================

const useSSL = process.env.DB_SSL === "true";

const databaseConfig = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};


// ==================================================
// SSL CONFIGURATION
// ==================================================

if (useSSL) {
    const caPath = process.env.DB_SSL_CA_FILE;

    let caCertificate = process.env.DB_SSL_CA;

    if (caPath) {
        caCertificate = fs.readFileSync(caPath, "utf8");
    }

    if (!caCertificate) {
        throw new Error(
            "Database SSL is enabled, but DB_SSL_CA or DB_SSL_CA_FILE is missing."
        );
    }

    databaseConfig.ssl = {
        ca: caCertificate,
        rejectUnauthorized: true
    };
}


// ==================================================
// CREATE DATABASE CONNECTION POOL
// ==================================================

const db = mysql.createPool(databaseConfig);


// ==================================================
// EXPORT DATABASE CONNECTION
// ==================================================

module.exports = db;
