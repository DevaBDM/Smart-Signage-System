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

const getActor = async (user) => {
  if (user.role === "admin") return user;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      username: true,
      role: true,
      department_id: true,
      can_manage_other_posts: true,
      creator_priority: true,
      control_lock_minutes: true,
    },
  });
  return dbUser || user;
};

const canManagePost = (user, post) =>
  user.role === "admin" ||
  post.created_by === user.id ||
  (user.can_manage_other_posts && user.department_id === post.department_id);

const assertControlAllowed = (user, device) => {
  if (user.role === "admin") return { ok: true };
  const now = new Date();
  const lockUntil = device.control_lock_until;
  const lockActive = lockUntil && lockUntil > now;
  const lockOwner = device.control_lock_user_id;
  const lockPriority = device.control_lock_priority || 0;
  const userPriority = user.creator_priority || 1;

  if (
    lockActive &&
    lockOwner &&
    lockOwner !== user.id &&
    lockPriority > userPriority
  ) {
    return {
      ok: false,
      error:
        `Display is locked by a higher-priority creator until ${lockUntil.toLocaleString()}.`,
    };
  }
  return { ok: true };
};

const applyControlLock = async (user, deviceId, action) => {
  if (user.role === "admin") return;
  const minutes = Math.max(1, Number(user.control_lock_minutes) || 120);
  await prisma.device.update({
    where: { id: deviceId },
    data: {
      control_lock_user_id: user.id,
      control_lock_priority: user.creator_priority || 1,
      control_lock_until: new Date(Date.now() + minutes * 60_000),
      control_lock_action: action,
    },
  });
};

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
  if (device.status !== "online") {
    res.status(400).json({
      error: `Display "${device.device_name}" is offline. Operation cancelled.`,
    });
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

// Device pull endpoint used by the Pi's periodic sync.
router.get("/device/:device_id/deployments", async (req, res) => {
  const deployments = await prisma.signageDeployment.findMany({
    where: {
      device_id: Number(req.params.device_id),
      status: { not: "removed" },
      post: { 
        status: "published",
        allowed_on_signage: true // ONLY pull if allowed
      },
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
  const actor = await getActor(req.user);
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
    include: { images: true, signage_metadata: true, author: true },
  });
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (
    actor.role !== "admin" &&
    post.department_id !== actor.department_id
  ) {
    return res.status(403).json({ error: "Cannot publish this post" });
  }
  if (!canManagePost(actor, post)) {
    return res.status(403).json({ error: "You need admin approval to publish another creator's post." });
  }
  const image = post.images[0];
  if (!image) return res.status(400).json({ error: "Post has no image" });

  const device = await prisma.device.findUnique({
    where: { id: Number(device_id) },
  });
  if (!device) return res.status(404).json({ error: "Device not found" });
  if (
    actor.role !== "admin" &&
    device.department_id !== actor.department_id
  ) {
    return res.status(403).json({ error: "Cannot publish to this device" });
  }
  const lock = assertControlAllowed(actor, device);
  if (!lock.ok) return res.status(423).json({ error: lock.error });
  if (!device.is_approved) {
    return res.status(403).json({
      error: "This device is pending approval and cannot be controlled yet.",
    });
  }
  if (device.status !== "online") {
    return res.status(400).json({
      error: `Update cancelled. These displays are offline: ${device.device_name}`,
    });
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

  const isAutoApprove = post.author?.auto_approve || actor.role === 'admin';

  // Mark signage intent / permission (post status stays draft until creator publishes)
  await prisma.post.update({
    where: { id: Number(post_id) },
    data: { 
       requested_signage: true,
       allowed_on_signage: isAutoApprove, 
    },
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

  // When auto-approved, Pi is online (checked above); otherwise only DB rows change until an admin allows signage.
  let result = { ok: true, note: "Deployment saved. Awaiting admin approval." };
  if (isAutoApprove) {
    if (existingAsset) {
      result = { ok: true, already_exists: true, asset: existingAsset };
      await upsertSignageAsset(prisma, {
        device_id,
        post_id: post.id,
        image_url: image?.image_path,
        asset: existingAsset,
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
      result = await sendSignageCommand(device_id, {
        action: "publish_asset",
        ...payload,
      });

      if (result.ok) {
        if (result.asset) {
          await upsertSignageAsset(prisma, {
            device_id,
            post_id: post.id,
            image_url: image?.image_path,
            asset: result.asset,
          });
        }
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
    }
  }

  await applyControlLock(actor, device.id, "publish");

  res.json({
    ok: true,
    pi_notified: !!(isAutoApprove && result.ok),
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
    const actor = await getActor(req.user);
    const lock = assertControlAllowed(actor, device);
    if (!lock.ok) return res.status(423).json({ error: lock.error });
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
    if (result.ok) await applyControlLock(actor, device.id, command);
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
    const actor = await getActor(req.user);
    const lock = assertControlAllowed(actor, device);
    if (!lock.ok) return res.status(423).json({ error: lock.error });

    const enabled = req.body.is_enabled !== false;
    const result = await sendSignageCommand(device.id, {
      action: enabled ? "show_asset" : "hide_asset",
      asset_id: req.params.asset_id,
    });
    if (result.ok) {
      await applyControlLock(actor, device.id, enabled ? "show_asset" : "hide_asset");
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
    const actor = await getActor(req.user);
    const lock = assertControlAllowed(actor, device);
    if (!lock.ok) return res.status(423).json({ error: lock.error });

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
      if (result.ok) await applyControlLock(actor, device.id, "delete_asset");
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

        // If no more deployments for this post, clear signage flag on the post.
        const remainingDeployments = await prisma.signageDeployment.count({
          where: { post_id: trackedAsset.post_id },
        });
        if (remainingDeployments === 0) {
          await prisma.post.update({
            where: { id: trackedAsset.post_id },
            data: { allowed_on_signage: false },
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
