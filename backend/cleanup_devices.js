const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.device.deleteMany({
    where: {
      device_name: "Research-Lab-Display",
      status: "offline"
    }
  });
  console.log(`✅ Deleted ${result.count} duplicate offline devices.`);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
