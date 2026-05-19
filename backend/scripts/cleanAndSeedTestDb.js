/** Clean test DB and seed test-admin + test-creator. */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

process.env.NODE_ENV = "test";
const prisma = require("../src/db/prisma");
const bcrypt = require("bcryptjs");

async function cleanDatabase() {
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

async function seedUsers() {
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

async function main() {
  await cleanDatabase();
  await seedUsers();
  await prisma.$disconnect();
  console.log("Test DB cleaned and seeded.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
