const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parsePostIdFromAssetName = (name) => {
  const match = String(name || "").match(/\((\d+)\)\s*$/);
  return match ? Number(match[1]) : null;
};

const normalizeAssetRecord = ({ device_id, post_id, image_url, asset }) => {
  const assetId = asset?.asset_id || asset?.id;
  if (!assetId) return null;

  return {
    device_id: Number(device_id),
    post_id: post_id ? Number(post_id) : parsePostIdFromAssetName(asset.name),
    asset_id: String(assetId),
    asset_name: asset.name || asset.asset_name || null,
    image_url: image_url || asset.uri || asset.image_url || null,
    mimetype: asset.mimetype || null,
    duration: asset.duration ? Number(asset.duration) : null,
    is_enabled: asset.is_enabled !== false,
    is_active:
      typeof asset.is_active === "boolean" ? Boolean(asset.is_active) : null,
    play_order:
      asset.play_order === undefined || asset.play_order === null
        ? null
        : Number(asset.play_order),
    start_date: parseDate(asset.start_date),
    end_date: parseDate(asset.end_date),
    last_synced_at: new Date(),
  };
};

const upsertSignageAsset = async (prisma, payload) => {
  const data = normalizeAssetRecord(payload);
  if (!data) return null;

  // If this asset is linked to a post, ensure we use the server's image_url
  // instead of the Pi's local internal path for the dashboard preview.
  if (data.post_id) {
    const post = await prisma.post.findUnique({
      where: { id: data.post_id },
      include: { images: { orderBy: { order_index: "asc" }, take: 1 } },
    });
    if (post && post.images[0]) {
      data.image_url = post.images[0].image_path;
    }
  }

  return prisma.signageAsset.upsert({
    where: {
      device_id_asset_id: {
        device_id: data.device_id,
        asset_id: data.asset_id,
      },
    },
    update: data,
    create: data,
  });
};

const syncSignageAssetList = async (prisma, device_id, assets) => {
  const rows = [];
  const foundAssetIds = [];

  for (const asset of assets || []) {
    const row = await upsertSignageAsset(prisma, { device_id, asset });
    if (row) {
      rows.push(row);
      foundAssetIds.push(row.asset_id);
    }
  }

  // PRUNE: Remove DB rows not returned by the Pi. Skip when the list is empty — an empty
  // response would otherwise match every asset_id and wipe all tracking (causing republishes / duplicates).
  if (foundAssetIds.length > 0) {
    await prisma.signageAsset.deleteMany({
      where: {
        device_id: Number(device_id),
        asset_id: { notIn: foundAssetIds },
      },
    });
  }

  return rows;
};

module.exports = {
  normalizeAssetRecord,
  parsePostIdFromAssetName,
  syncSignageAssetList,
  upsertSignageAsset,
};
