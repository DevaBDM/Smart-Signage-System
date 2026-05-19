process.env.NODE_ENV = "test";
const prisma = require("../src/db/prisma");

async function main() {
  const postId = Number(process.argv[2]);
  const deviceId = Number(process.argv[3]);
  const assetId = process.argv[4] || `asset-${Date.now()}`;

  if (!postId || !deviceId) {
    console.error("Usage: node seedSignageAsset.js <postId> <deviceId> [assetId]");
    process.exit(1);
  }

  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { images: true },
  });

  await prisma.signageAsset.upsert({
    where: {
      device_id_asset_id: {
        device_id: deviceId,
        asset_id: assetId,
      },
    },
    update: {},
    create: {
      device_id: deviceId,
      asset_id: assetId,
      post_id: postId,
      image_url: post?.images?.[0]?.image_path || "",
      mimetype: "image/jpeg",
      asset_name: post?.title || "Test Asset",
      duration: 10,
      is_enabled: true,
      is_active: true,
      play_order: 0,
    },
  });

  await prisma.signageDeployment.upsert({
    where: {
      device_id_post_id: {
        device_id: deviceId,
        post_id: postId,
      },
    },
    update: {},
    create: {
      device_id: deviceId,
      post_id: postId,
      duration_seconds: 10,
      status: "synced",
    },
  });

  console.log(JSON.stringify({ asset_id: assetId }));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
