require("dotenv").config();

const { initializeDatabase, closeDatabase } = require("../db");

initializeDatabase()
  .then(() => {
    console.log("Database initialized successfully.");
    return closeDatabase();
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
