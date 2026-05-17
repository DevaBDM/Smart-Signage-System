const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const posts = await prisma.post.findMany({
    where: { id: { in: [7, 8] } },
    include: { images: true, signage_deployments: true, signage_metadata: true }
  });
  console.log('--- POSTS ---');
  console.log(JSON.stringify(posts, null, 2));

  const assets = await prisma.signageAsset.findMany({
    where: { post_id: { in: [7, 8] } }
  });
  console.log('--- SIGNAGE ASSETS ---');
  console.log(JSON.stringify(assets, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
