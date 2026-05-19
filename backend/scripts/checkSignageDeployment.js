process.env.NODE_ENV = "test";
const prisma = require("../src/db/prisma");

async function main() {
  const postId = Number(process.argv[2]);
  const deviceId = Number(process.argv[3]);
  if (!postId || !deviceId) {
    console.error("Usage: node checkSignageDeployment.js <postId> <deviceId>");
    process.exit(1);
  }

  const deps = await prisma.signageDeployment.findMany({
    where: { post_id: postId, device_id: deviceId },
  });

  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { status: true },
  });

  console.log(JSON.stringify({ deployments: deps.length, deviceStatus: device?.status }));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
