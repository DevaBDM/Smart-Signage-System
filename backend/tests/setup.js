require("dotenv").config();
const prisma = require("../src/db/prisma");

/** Clean all tables between tests. Order matters for FK constraints. */
async function cleanDatabase() {
  // Delete children first to respect foreign keys
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
  await prisma.liveStream.deleteMany({});
  await prisma.userGroup.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.group.deleteMany({});
}

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL is required. " +
        "Create a test DB and set the env var before running tests.",
    );
  }
});

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});
