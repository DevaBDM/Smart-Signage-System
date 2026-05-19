/** Create a pending (unapproved) device for E2E testing. */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

process.env.NODE_ENV = "test";
const prisma = require("../src/db/prisma");

async function main() {
  const groupId = process.argv[2] ? Number(process.argv[2]) : null;

  const device = await prisma.device.create({
    data: {
      device_name: "Unapproved Device",
      ip_address: "0.0.0.0",
      location: null,
      status: "offline",
      is_approved: false,
      pending_name: "Lab-Pi-01",
      pending_ip: "192.168.1.50",
      pending_location: null,
      ...(groupId && { group_id: groupId }),
    },
  });

  console.log(JSON.stringify({ id: device.id }));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
