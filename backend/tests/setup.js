const prisma = require("../src/db/prisma");

/** Clean all tables between tests. Order matters for FK constraints. */
async function cleanDatabase() {
  await prisma.playlistItem.deleteMany({});
  await prisma.playlist.deleteMany({});
  await prisma.signageDeployment.deleteMany({});
  await prisma.signageAsset.deleteMany({});
  await prisma.signageMetadata.deleteMany({});
  try { await prisma.postImage.deleteMany({}); } catch { /* ignore */ }
  await prisma.postAttachment.deleteMany({});
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

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});
