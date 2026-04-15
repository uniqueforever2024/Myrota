require("dotenv").config();

const { testConnection, closeDatabase } = require("../db");

async function main() {
  try {
    const result = await testConnection();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await closeDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
