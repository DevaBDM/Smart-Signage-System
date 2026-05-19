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

async function cleanDatabase(prisma) {
  await prisma.playlistItem.deleteMany({});
  await prisma.playlist.deleteMany({});
  await prisma.signageDeployment.deleteMany({});
  await prisma.signageAsset.deleteMany({});
  await prisma.signageMetadata.deleteMany({});
  await prisma.postImage.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.errorLog.deleteMany({});
  await prisma.sensorLog.deleteMany({});
  await prisma.deviceGroup.deleteMany({});
  await prisma.device.deleteMany({});
  await prisma.userGroup.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.group.deleteMany({});
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
