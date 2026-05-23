const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.postAttachment.findMany({ take: 1 });
    console.log("PostAttachment table exists and is accessible.");
  } catch (e) {
    console.error("Error:", e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
