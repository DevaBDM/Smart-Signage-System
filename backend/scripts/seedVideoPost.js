process.env.NODE_ENV = "test";
const prisma = require("../src/db/prisma");

async function main() {
  const groupId = Number(process.argv[2]);
  const creatorId = Number(process.argv[3]);
  const title = process.argv[4] || "Video Post";

  if (!groupId || !creatorId) {
    console.error("Usage: node seedVideoPost.js <groupId> <creatorId> [title]");
    process.exit(1);
  }

  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now()}`;

  const post = await prisma.post.create({
    data: {
      title,
      slug,
      group_id: groupId,
      created_by: creatorId,
      status: "published",
      allowed_on_signage: true,
      signage_state: "NORMAL",
    },
  });

  await prisma.postImage.create({
    data: {
      post_id: post.id,
      image_path: "/uploads/videos/test.mp4",
      media_type: "VIDEO",
      duration_seconds: 15,
      order_index: 0,
    },
  });

  console.log(JSON.stringify(post));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
