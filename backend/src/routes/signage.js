const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const {
  syncSignageAssetList,
  upsertSignageAsset,
} = require("../utils/signageAssets");

let _emitToDeviceAck; // injected from index.js

router.use((req, _, next) => {
  _emitToDeviceAck = req.app.get("emitToDeviceAck");
  next();
});

const canUseDevice = (user, device) =>
  user.role === "admin" || device.department_id === user.department_id;

const getAllowedDevice = async (req, res) => {
  const device = await prisma.device.findUnique({
    where: { id: Number(req.params.device_id || req.body.device_id) },
  });
  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return null;
  }
  if (!device.is_approved) {
    res.status(403).json({ error: "This device is pending approval and cannot be controlled yet." });
    return null;
  }
  if (!canUseDevice(req.user, device)) {
    res.status(403).json({ error: "Cannot control this device" });
    return null;
  }
  return device;
};

const sendSignageCommand = async (device_id, payload) => {
  if (!_emitToDeviceAck) {
    return { ok: false, error: "Socket bridge is not ready" };
  }
  return _emitToDeviceAck(device_id, "signage_command", payload, 12000);
};

// Device pull endpoint used by the Pi's periodic sync. This is intentionally
// device-scoped so one display cannot accidentally pull every signage post.
router.get("/device/:device_id/deployments", async (req, res) => {
  const deployments = await prisma.signageDeployment.findMany({
    where: {
      device_id: Number(req.params.device_id),
      status: { not: "removed" },
      post: { status: "published" }, // NEW: Only show published content on screens
    },
    include: {
      post: {
        include: {
          images: { orderBy: { order_index: "asc" }, take: 1 },
        },
      },
    },
    orderBy: [{ priority: "asc" }, { created_at: "desc" }],
  });

  res.json(
    deployments
      .filter((deployment) => deployment.post.images[0])
      .map((deployment) => ({
        deployment_id: deployment.id,
        post_id: deployment.post_id,
        title: deployment.post.title,
        image_url: deployment.post.images[0].image_path,
        duration_seconds: deployment.duration_seconds,
        start_date: deployment.start_date,
        end_date: deployment.end_date,
        priority: deployment.priority,
        display_group: deployment.display_group,
      })),
  );
});

// Publish a post to signage → notifies Pi via Socket.IO
router.post("/publish", auth(["admin", "creator"]), async (req, res) => {
  const {
    post_id,
    device_id,
    duration_seconds,
    start_date,
    end_date,
    priority,
    display_group,
  } = req.body;

  const post = await prisma.post.findUnique({
    where: { id: Number(post_id) },
    include: { images: true, signage_metadata: true },
  });
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (
    req.user.role !== "admin" &&
    post.department_id !== req.user.department_id
  ) {
    return res.status(403).json({ error: "Cannot publish this post" });
  }
  const image = post.images[0];
  if (!image) return res.status(400).json({ error: "Post has no image" });

  const device = await prisma.device.findUnique({
    where: { id: Number(device_id) },
  });
  if (!device) return res.status(404).json({ error: "Device not found" });
  if (
    req.user.role !== "admin" &&
    device.department_id !== req.user.department_id
  ) {
    return res.status(403).json({ error: "Cannot publish to this device" });
  }

  if (device.status !== "online") {
    return res.status(400).json({ error: `Display "${device.device_name}" is offline. Asset was not published.` });
  }

  // Upsert signage metadata
  await prisma.signageMetadata.upsert({
    where: { post_id: Number(post_id) },
    update: {
      duration_seconds: Number(duration_seconds) || 10,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      priority: Number(priority) || 1,
      display_group: display_group || null,
    },
    create: {
      post_id: Number(post_id),
      duration_seconds: Number(duration_seconds) || 10,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      priority: Number(priority) || 1,
      display_group: display_group || null,
    },
  });

  // Mark post as published signage
  await prisma.post.update({
    where: { id: Number(post_id) },
    data: { publish_to_signage: true, status: "published" },
  });

  const payload = {
    post_id: post.id,
    title: post.title,
    image_url: image?.image_path,
    duration_seconds: Number(duration_seconds) || 10,
    start_date: start_date || null,
    end_date: end_date || null,
  };

  const existingAsset = await prisma.signageAsset.findFirst({
    where: {
      device_id: Number(device_id),
      post_id: post.id,
    },
  });

  await prisma.signageDeployment.upsert({
    where: {
      device_id_post_id: {
        device_id: Number(device_id),
        post_id: post.id,
      },
    },
    update: {
      duration_seconds: Number(duration_seconds) || 10,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      priority: Number(priority) || 1,
      display_group: display_group || null,
      status: "pending",
      last_error: null,
    },
    create: {
      device_id: Number(device_id),
      post_id: post.id,
      duration_seconds: Number(duration_seconds) || 10,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      priority: Number(priority) || 1,
      display_group: display_group || null,
      status: "pending",
    },
  });

  const result = existingAsset
    ? { ok: true, already_exists: true, asset: existingAsset }
    : await sendSignageCommand(device_id, {
        action: "publish_asset",
        ...payload,
      });

  if (result.ok) {
    await upsertSignageAsset(prisma, {
      device_id,
      post_id: post.id,
      image_url: image?.image_path,
      asset: result.asset,
    });
    await prisma.signageDeployment.update({
      where: {
        device_id_post_id: {
          device_id: Number(device_id),
          post_id: post.id,
        },
      },
      data: { status: "synced", last_error: null },
    });
  } else {
    await prisma.signageDeployment.update({
      where: {
        device_id_post_id: {
          device_id: Number(device_id),
          post_id: post.id,
        },
      },
      data: { status: "pending", last_error: result.error || null },
    });
  }

  res.json({
    ok: true,
    pi_notified: !!result.ok,
    pi_result: result,
  });
});

// List assets currently known to Anthias on one display.
router.get(
  "/devices/:device_id/assets",
  auth(["admin", "creator"]),
  async (req, res) => {
    const device = await getAllowedDevice(req, res);
    if (!device) return;
    const trackedAssets = await prisma.signageAsset.findMany({
      where: { device_id: device.id },
      include: { post: { select: { title: true, id: true } } },
      orderBy: { updated_at: "desc" },
    });
    const result = await sendSignageCommand(device.id, { action: "list" });
    if (result.ok) {
      const tracked = await syncSignageAssetList(
        prisma,
        device.id,
        result.assets,
      );
      return res.json({ ...result, tracked_assets: tracked });
    }
    res.json({
      ...result,
      stale: true,
      assets: trackedAssets.map((asset) => ({
        asset_id: asset.asset_id,
        name: asset.asset_name || asset.post?.title,
        uri: asset.image_url,
        mimetype: asset.mimetype,
        duration: asset.duration,
        is_enabled: asset.is_enabled,
        is_active: asset.is_active,
        play_order: asset.play_order,
        start_date: asset.start_date,
        end_date: asset.end_date,
        post_id: asset.post_id,
      })),
    });
  },
);

// Playback controls: next, previous, or start a specific asset.
router.post(
  "/devices/:device_id/control",
  auth(["admin", "creator"]),
  async (req, res) => {
    const device = await getAllowedDevice(req, res);
    if (!device) return;

    const { command, asset_id } = req.body;
    if (!["next", "previous", "start"].includes(command)) {
      return res.status(400).json({ error: "Invalid command" });
    }
    if (command === "start" && !asset_id) {
      return res.status(400).json({ error: "asset_id is required" });
    }

    const result = await sendSignageCommand(device.id, {
      action: command,
      asset_id,
    });
    res.status(result.ok ? 200 : 503).json(result);
  },
);

// Hide/show a display asset without deleting it from Anthias.
router.patch(
  "/devices/:device_id/assets/:asset_id",
  auth(["admin", "creator"]),
  async (req, res) => {
    const device = await getAllowedDevice(req, res);
    if (!device) return;

    const enabled = req.body.is_enabled !== false;
    const result = await sendSignageCommand(device.id, {
      action: enabled ? "show_asset" : "hide_asset",
      asset_id: req.params.asset_id,
    });
    if (result.ok) {
      await prisma.signageAsset
        .update({
          where: {
            device_id_asset_id: {
              device_id: device.id,
              asset_id: String(req.params.asset_id),
            },
          },
          data: { is_enabled: enabled, last_synced_at: new Date() },
        })
        .catch(() => {});
    }
    res.status(result.ok ? 200 : 503).json(result);
  },
);

// Permanently delete an asset from Anthias.
router.delete(
  "/devices/:device_id/assets/:asset_id",
  auth(["admin", "creator"]),
  async (req, res) => {
    const device = await getAllowedDevice(req, res);
    if (!device) return;

    const assetId = String(req.params.asset_id);

    // 1. Try to find if this asset is linked to a post
    const trackedAsset = await prisma.signageAsset.findUnique({
      where: {
        device_id_asset_id: {
          device_id: device.id,
          asset_id: assetId,
        },
      },
    });

    // 2. Notify the Pi to delete from local Anthias
    const result = await sendSignageCommand(device.id, {
      action: "delete_asset",
      asset_id: assetId,
    });

    // 3. If socket command worked (or even if it failed but we want to clean DB),
    // we MUST remove the deployment/asset records so the Pi doesn't re-sync them.
    if (result.ok || req.query.force === "true") {
      // Remove from SignageAsset (tracking)
      await prisma.signageAsset
        .delete({
          where: {
            device_id_asset_id: {
              device_id: device.id,
              asset_id: assetId,
            },
          },
        })
        .catch(() => {});

      // If we know which post this was, remove the SignageDeployment
      // so the /deployments endpoint no longer lists it for this device.
      if (trackedAsset && trackedAsset.post_id) {
        await prisma.signageDeployment
          .delete({
            where: {
              device_id_post_id: {
                device_id: device.id,
                post_id: trackedAsset.post_id,
              },
            },
          })
          .catch(() => {});

        // NEW: If no more deployments exist for this post, unmark it as a signage post
        const remainingDeployments = await prisma.signageDeployment.count({
          where: { post_id: trackedAsset.post_id },
        });
        if (remainingDeployments === 0) {
          await prisma.post.update({
            where: { id: trackedAsset.post_id },
            data: { publish_to_signage: false },
          });
        }
      }
    }
    res.status(result.ok ? 200 : 503).json(result);
  },
);

// Get signage playlists
router.get("/playlists", auth(["admin"]), async (req, res) => {
  const playlists = await prisma.playlist.findMany({
    include: {
      items: {
        include: { post: { include: { images: true } } },
        orderBy: { order_index: "asc" },
      },
    },
  });
  res.json(playlists);
});

module.exports = router;
