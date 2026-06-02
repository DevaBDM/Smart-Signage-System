require("dotenv").config();
const { execSync } = require("child_process");
const path = require("path");

module.exports = async () => {
  if (!process.env.TEST_DATABASE_URL) {
    const envPath = path.resolve(__dirname, ".env");
    require("dotenv").config({ path: envPath });
  }

  const testDbUrl = (process.env.TEST_DATABASE_URL || "").replace(/^"(.*)"$/, "$1");
  if (!testDbUrl) {
    console.error("TEST_DATABASE_URL is required. Set it in backend/.env");
    process.exit(1);
  }

  const url = new URL(testDbUrl);
  const dbName = decodeURIComponent(url.pathname.slice(1));

  console.log(`[jestGlobalSetup] Ensuring database "${dbName}" exists...`);

  // Try to create database using psql (works with any admin user)
  try {
    const adminUrl = `postgresql://postgres@${url.hostname}:${url.port}/postgres`;
    const { Client } = require("pg");
    const client = new Client({ connectionString: adminUrl });
    await client.connect();
    try {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`[jestGlobalSetup] Created database: ${dbName}`);
    } catch (e) {
      if (e.code === "42P04") {
        console.log(`[jestGlobalSetup] Database "${dbName}" already exists`);
      } else {
        console.error(`[jestGlobalSetup] Failed to create database: ${e.message}`);
      }
    }
    await client.end();
  } catch (e) {
    console.warn(`[jestGlobalSetup] Could not auto-create database: ${e.message}`);
    console.warn(`[jestGlobalSetup] Assuming "${dbName}" already exists...`);
  }

  console.log("[jestGlobalSetup] Pushing Prisma schema and generating client...");
  execSync(`npx prisma db push`, {
    cwd: __dirname,
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: "inherit",
  });

  console.log("[jestGlobalSetup] Done — test database ready");
};
