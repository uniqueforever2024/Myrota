require("dotenv").config();

const { testConnection, closeDatabase } = require("../db");

testConnection()
  .then((result) => {
    console.log("Database connection successful.");
    console.log(`Connected at: ${result.connected_at}`);
    return closeDatabase();
  })
  .catch((error) => {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  });
