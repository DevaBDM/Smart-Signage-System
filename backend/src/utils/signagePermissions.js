const prisma = require("../db/prisma");
const { canManagePost } = require("./permissions");

const assertCanManageAsset = async (actor, deviceId, assetId) => {
  const tracked = await prisma.signageAsset.findUnique({
    where: {
      device_id_asset_id: {
        device_id: Number(deviceId),
        asset_id: String(assetId),
      },
    },
  });

  if (actor.role === "admin") {
    return { ok: true, tracked, post: null };
  }

  if (!tracked?.post_id) {
    return {
      ok: false,
      error: "You can only control signage assets linked to your own posts.",
    };
  }

  const post = await prisma.post.findUnique({
    where: { id: tracked.post_id },
    select: { id: true, created_by: true, group_id: true },
  });
  if (!post || !canManagePost(actor, post)) {
    return {
      ok: false,
      error: "You cannot modify another creator's post on this display.",
    };
  }

  return { ok: true, tracked, post };
};

module.exports = { assertCanManageAsset };
