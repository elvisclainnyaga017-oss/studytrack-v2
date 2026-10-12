// ==================================================
// STUDYTRACK V2
// DATABASE CONNECTION TEST
// ==================================================

require("dotenv").config();

const db = require("./db");


// ==================================================
// TEST CONNECTION
// ==================================================

async function testDatabaseConnection() {
    let connection;

    try {
        connection = await db.getConnection();

        const [rows] = await connection.query(`
            SELECT
                DATABASE() AS database_name,
                CURRENT_USER() AS database_user,
                @@port AS database_port,
                VERSION() AS database_version
        `);

        console.log("\n====================================");
        console.log("STUDYTRACK V2 DATABASE TEST");
        console.log("====================================");

        console.log("Connection: SUCCESS");
        console.log("Database:", rows[0].database_name);
        console.log("User:", rows[0].database_user);
        console.log("Port:", rows[0].database_port);
        console.log("Version:", rows[0].database_version);

        console.log("====================================\n");

    } catch (error) {
        console.error("\nDATABASE CONNECTION FAILED");
        console.error("Error code:", error.code || "UNKNOWN");
        console.error("Error message:", error.message);

        process.exitCode = 1;

    } finally {
        if (connection) {
            connection.release();
        }

        await db.end();
    }
}


// ==================================================
// RUN TEST
// ==================================================

testDatabaseConnection();