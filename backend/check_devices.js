const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const devices = await prisma.device.findMany({
    select: {
      id: true,
      device_name: true,
      status: true,
      group_id: true
    }
  });
  console.log(JSON.stringify(devices, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
