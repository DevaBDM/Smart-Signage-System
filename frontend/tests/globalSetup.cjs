/** Playwright global setup — ensure test DB exists, push schema, clean and seed. */
const path = require("path");
const { execSync, exec } = require("child_process");
const { createRequire } = require("module");

const backendRoot = path.resolve(__dirname, "../../backend");
const backendRequire = createRequire(path.join(backendRoot, "package.json"));

backendRequire("dotenv").config({ path: path.join(backendRoot, ".env") });

const TEST_DB_URL = (process.env.TEST_DATABASE_URL || "").replace(/^"(.*)"$/, "$1");
if (!TEST_DB_URL) {
  throw new Error("TEST_DATABASE_URL is not set. Check your backend/.env file.");
}

async function ensureDatabaseExists() {
  const url = new URL(TEST_DB_URL);
  const dbName = decodeURIComponent(url.pathname.slice(1));

  try {
    const { Client } = backendRequire("pg");
    const adminUrl = `postgresql://postgres@${url.hostname}:${url.port}/postgres`;
    const client = new Client({ connectionString: adminUrl });
    await client.connect();
    try {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`[globalSetup] Created database: ${dbName}`);
    } catch (e) {
      if (e.code === "42P04") {
        console.log(`[globalSetup] Database "${dbName}" already exists`);
      } else {
        console.error(`[globalSetup] DB error: ${e.message}`);
      }
    }
    await client.end();
  } catch (e) {
    console.warn(`[globalSetup] Could not auto-create DB: ${e.message}`);
  }
}

async function pushSchema() {
  return new Promise((resolve, reject) => {
    const child = exec(`npx prisma db push`, {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdio: "pipe",
    }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
    child.stdout.on("data", (d) => process.stdout.write(d));
    child.stderr.on("data", (d) => process.stderr.write(d));
  });
}

const { PrismaClient } = backendRequire("@prisma/client");
const bcrypt = backendRequire("bcryptjs");

async function safeDelete(prisma, model) {
  try {
    await prisma[model].deleteMany({});
  } catch (e) {
    if (e.code !== "P2021") throw e;
  }
}

async function cleanDatabase(prisma) {
  await safeDelete(prisma, "playlistItem");
  await safeDelete(prisma, "playlist");
  await safeDelete(prisma, "signageDeployment");
  await safeDelete(prisma, "signageAsset");
  await safeDelete(prisma, "signageMetadata");
  await safeDelete(prisma, "postImage");
  await safeDelete(prisma, "postAttachment");
  await safeDelete(prisma, "post");
  await safeDelete(prisma, "liveStream");
  await safeDelete(prisma, "errorLog");
  await safeDelete(prisma, "sensorLog");
  await safeDelete(prisma, "deviceGroup");
  await safeDelete(prisma, "device");
  await safeDelete(prisma, "userGroup");
  await safeDelete(prisma, "user");
  await safeDelete(prisma, "group");
}

async function seedUsers(prisma) {
  const hash = await bcrypt.hash("TestPass123!", 10);

  await prisma.user.create({
    data: {
      username: "test-admin",
      password_hash: hash,
      role: "admin",
      auto_approve: true,
    },
  });

  const group = await prisma.group.create({
    data: { name: "Creator Test Group" },
  });

  await prisma.user.create({
    data: {
      username: "test-creator",
      password_hash: hash,
      role: "creator",
      auto_approve: true,
      group_id: group.id,
    },
  });
}

module.exports = async function globalSetup() {
  await ensureDatabaseExists();
  await pushSchema();

  const prisma = new PrismaClient({
    datasources: { db: { url: TEST_DB_URL } },
  });

  await cleanDatabase(prisma);
  await seedUsers(prisma);

  await prisma.$disconnect();
  console.log("[globalSetup] Test DB cleaned and seeded.");
};
