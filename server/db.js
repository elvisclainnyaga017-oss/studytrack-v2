// ==================================================
// STUDYTRACK V2
// DATABASE CONNECTION
// ==================================================

const mysql = require("mysql2/promise");
require("dotenv").config();


// ==================================================
// DATABASE CONFIGURATION
// ==================================================

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


// ==================================================
// EXPORT DATABASE CONNECTION
// ==================================================

module.exports = db;