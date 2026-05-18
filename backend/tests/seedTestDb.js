const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function seed() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.TEST_DATABASE_URL } },
  });

  const hash = await bcrypt.hash("TestPass123!", 10);

  await prisma.user.upsert({
    where: { username: "test-admin" },
    update: {},
    create: {
      username: "test-admin",
      password_hash: hash,
      role: "admin",
      auto_approve: true,
    },
  });

  await prisma.user.upsert({
    where: { username: "test-creator" },
    update: {},
    create: {
      username: "test-creator",
      password_hash: hash,
      role: "creator",
      auto_approve: true,
    },
  });

  await prisma.$disconnect();
  console.log("Test DB seeded: test-admin, test-creator (password: TestPass123!)");
}

seed().catch((e) => {
  console.error(e);
  throw e;
});
