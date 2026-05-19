process.env.NODE_ENV = "test";
const prisma = require("../src/db/prisma");

async function main() {
  const postId = Number(process.argv[2]);
  const deviceId = Number(process.argv[3]);
  if (!postId || !deviceId) {
    console.error("Usage: node seedSignageDeployment.js <postId> <deviceId>");
    process.exit(1);
  }

  const dep = await prisma.signageDeployment.create({
    data: {
      device_id: deviceId,
      post_id: postId,
      duration_seconds: 10,
      status: "pending",
    },
  });

  console.log(JSON.stringify(dep));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
