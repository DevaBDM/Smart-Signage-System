/** Playwright global setup — clean and seed the test database before e2e runs. */
const path = require("path");
const { createRequire } = require("module");

const backendRoot = path.resolve(__dirname, "../../backend");
const backendRequire = createRequire(path.join(backendRoot, "package.json"));

const { PrismaClient } = backendRequire("@prisma/client");
const bcrypt = backendRequire("bcryptjs");
backendRequire("dotenv").config({ path: path.join(backendRoot, ".env") });

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
if (!TEST_DB_URL) {
  throw new Error("TEST_DATABASE_URL is not set. Check your backend/.env file.");
}

async function safeDelete(prisma, model) {
  try {
    await prisma[model].deleteMany({});
  } catch (e) {
    if (e.code !== "P2021") throw e; // ignore "table does not exist"
  }
}

async function cleanDatabase(prisma) {
  await safeDelete(prisma, "playlistItem");
  await safeDelete(prisma, "playlist");
  await safeDelete(prisma, "signageDeployment");
  await safeDelete(prisma, "signageAsset");
  await safeDelete(prisma, "signageMetadata");
  await safeDelete(prisma, "postImage");
  await safeDelete(prisma, "post");
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
  const prisma = new PrismaClient({
    datasources: { db: { url: TEST_DB_URL } },
  });

  await cleanDatabase(prisma);
  await seedUsers(prisma);

  await prisma.$disconnect();
  console.log("[globalSetup] Test DB cleaned and seeded.");
};
