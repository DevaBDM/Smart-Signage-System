const { updateUser } = require("../src/services/userService");
const prisma = require("../src/db/prisma");

async function cleanDatabase() {
  await prisma.playlistItem.deleteMany();
  await prisma.playlist.deleteMany();
  await prisma.signageDeployment.deleteMany();
  await prisma.signageAsset.deleteMany();
  await prisma.signageMetadata.deleteMany();
  await prisma.postImage.deleteMany();
  await prisma.post.deleteMany();
  await prisma.errorLog.deleteMany();
  await prisma.sensorLog.deleteMany();
  await prisma.deviceGroup.deleteMany();
  await prisma.device.deleteMany();
  await prisma.userGroup.deleteMany();
  await prisma.user.deleteMany();
  await prisma.group.deleteMany();
}

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe("userService priority swap", () => {
  it("assigns next priority when a user becomes a creator without explicit priority", async () => {
    const g = await prisma.group.create({ data: { name: "g1" } });
    await prisma.user.create({
      data: { username: "alice", password_hash: "hash", role: "creator", group_id: g.id, creator_priority: 1 },
    });
    const bob = await prisma.user.create({
      data: { username: "bob", password_hash: "hash", role: "admin", group_id: g.id, creator_priority: 0 },
    });

    const result = await updateUser(bob.id, { role: "creator" });

    expect(result.role).toBe("creator");
    expect(result.creator_priority).toBe(2);
  });

  it("swaps priorities when two creators collide", async () => {
    const g = await prisma.group.create({ data: { name: "g1" } });
    const alice = await prisma.user.create({
      data: { username: "alice", password_hash: "hash", role: "creator", group_id: g.id, creator_priority: 1 },
    });
    const bob = await prisma.user.create({
      data: { username: "bob", password_hash: "hash", role: "creator", group_id: g.id, creator_priority: 2 },
    });

    // Bob wants Alice's priority 1
    const result = await updateUser(bob.id, { creator_priority: 1 });

    expect(result.creator_priority).toBe(1);

    const aliceAfter = await prisma.user.findUnique({ where: { id: alice.id } });
    expect(aliceAfter.creator_priority).toBe(2);
  });

  it("updates priority without swap when no collision", async () => {
    const g = await prisma.group.create({ data: { name: "g1" } });
    const alice = await prisma.user.create({
      data: { username: "alice", password_hash: "hash", role: "creator", group_id: g.id, creator_priority: 1 },
    });

    const result = await updateUser(alice.id, { creator_priority: 5 });

    expect(result.creator_priority).toBe(5);
  });

  it("allows any priority for non-creator", async () => {
    const g = await prisma.group.create({ data: { name: "g1" } });
    const admin = await prisma.user.create({
      data: { username: "admin", password_hash: "hash", role: "admin", group_id: g.id, creator_priority: 0 },
    });

    const result = await updateUser(admin.id, { creator_priority: 99 });

    expect(result.creator_priority).toBe(99);
  });
});
