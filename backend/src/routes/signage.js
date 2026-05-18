const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const {
  syncSignageAssetList,
  upsertSignageAsset,
} = require("../utils/signageAssets");
const { mediaFileExists } = require("../utils/mediaProcessor");
const {
  postVisibleForGroup,
  compareByUrgency,
  parseSignageState,
  canCreatorAssignState,
} = require("../utils/signageStates");
const { getActor, canManagePost } = require("../utils/permissions");
const { assertControlAllowed, applyControlLock } = require("../utils/controlLock");
const { canUseDevice, getAllowedDevice } = require("../utils/devicePermissions");
const { assertCanManageAsset } = require("../utils/signagePermissions");
const piBridge = require("../services/piBridge");

const sendSignageCommand = async (device_id, payload) =>
  piBridge.emitToDeviceAck(device_id, "signage_command", payload, 12000);

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
          group: { select: { id: true, signage_state: true } },
        },
      },
    },
    orderBy: [{ priority: "asc" }, { created_at: "desc" }],
  });

  const visible = deployments
    .filter((deployment) => deployment.post.images[0])
    .filter((deployment) => mediaFileExists(deployment.post.images[0].image_path))
    .filter((deployment) =>
      postVisibleForGroup(
        deployment.post.signage_state,
        deployment.post.group?.signage_state,
      ),
    )
    .sort((a, b) => {
      const byState = compareByUrgency(a.post.signage_state, b.post.signage_state);
      if (byState !== 0) return byState;
      const byPriority = (a.priority || 1) - (b.priority || 1);
      if (byPriority !== 0) return byPriority;
      return b.created_at - a.created_at;
    });

  res.json(
    visible.map((deployment) => ({
      deployment_id: deployment.id,
      post_id: deployment.post_id,
      title: deployment.post.title,
        image_url: deployment.post.images[0].image_path,
        media_type: deployment.post.images[0].media_type || "IMAGE",
        duration_seconds:
          deployment.post.images[0].duration_seconds ||
          deployment.duration_seconds,
      start_date: deployment.start_date,
      end_date: deployment.end_date,
      priority: deployment.priority,
      display_group: deployment.display_group,
      signage_state: deployment.post.signage_state,
      group_signage_state: deployment.post.group?.signage_state,
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
  
  if (!canManagePost(actor, post)) {
    return res.status(403).json({ error: "Cannot publish this post" });
  }

  if (req.body.signage_state !== undefined) {
    const parsed = parseSignageState(req.body.signage_state);
    if (!parsed) return res.status(400).json({ error: "Invalid signage_state" });
    if (
      actor.role !== "admin" &&
      !canCreatorAssignState(actor.max_signage_state, parsed)
    ) {
      return res.status(403).json({
        error: `You may only publish signage posts up to ${actor.max_signage_state || "NORMAL"} level.`,
      });
    }
    await prisma.post.update({
      where: { id: post.id },
      data: { signage_state: parsed },
    });
    post.signage_state = parsed;
  } else if (
    actor.role !== "admin" &&
    !canCreatorAssignState(actor.max_signage_state, post.signage_state)
  ) {
    return res.status(403).json({
      error: `This post's signage level exceeds your allowed maximum (${actor.max_signage_state || "NORMAL"}).`,
    });
  }

  const image = post.images[0];
  if (!image) return res.status(400).json({ error: "Post has no media" });
  if (!mediaFileExists(image.image_path)) {
    return res.status(400).json({
      error: `Media file missing on server: ${image.image_path}. Re-upload the video on the post.`,
    });
  }

  const mediaDuration =
    image.duration_seconds || Number(duration_seconds) || 10;

  const device = await prisma.device.findUnique({
    where: { id: Number(device_id) },
    include: { groups: true }
  });
  if (!device) return res.status(404).json({ error: "Device not found" });
  
  if (!canUseDevice(actor, device)) {
    return res.status(403).json({ error: "Cannot publish to this device" });
  }

  const lock = assertControlAllowed(actor, device);
  if (!lock.ok) return res.status(403).json({ error: lock.error });

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
      duration_seconds: mediaDuration,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      priority: Number(priority) || 1,
      display_group: display_group || null,
    },
    create: {
      post_id: Number(post_id),
      duration_seconds: mediaDuration,
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
    media_type: image.media_type || "IMAGE",
    duration_seconds: mediaDuration,
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
      duration_seconds: mediaDuration,
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
      duration_seconds: mediaDuration,
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
      await applyControlLock(actor, Number(device_id), "publish_asset");
    } else {
      result = await sendSignageCommand(device_id, {
        action: "publish_asset",
        ...payload,
      });

      if (result.ok) {
        if (result.asset) {
          await upsertSignageAsset(prisma, {
            device_id: device.id,
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
        await applyControlLock(actor, Number(device_id), "publish_asset");
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

  const piOk = !isAutoApprove || result.ok;
  res.status(piOk ? 200 : 502).json({
    ok: piOk,
    pi_notified: !!(isAutoApprove && result.ok),
    pi_result: result,
    error: piOk ? undefined : result.error || "Display could not sync this asset",
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
      include: {
        post: {
          select: {
            title: true,
            id: true,
            created_by: true,
            group_id: true,
            images: { orderBy: { order_index: "asc" }, take: 1 },
          },
        },
      },
      orderBy: { updated_at: "desc" },
    });

    // For non-admin creators, restrict tracked rows to assets linked to posts in
    // groups they can access (own group + managed groups). Unlinked assets stay
    // visible (admins curate them) but creators cannot manage them downstream.
    const allowedGroupIds =
      req.user.role === "admin"
        ? null
        : [req.user.group_id, ...(req.user.managed_group_ids || [])].filter(Boolean);
    const visibleTracked = (rows) =>
      allowedGroupIds === null
        ? rows
        : rows.filter((asset) => {
            const gid = asset.post?.group_id;
            if (gid == null) return false; // hide cross-group / unlinked rows from creators
            return allowedGroupIds.includes(gid);
          });

    const mapTracked = (rows) =>
      visibleTracked(rows).map((asset) => {
        const media = asset.post?.images?.[0];
        return {
          asset_id: asset.asset_id,
          post_id: asset.post_id,
          image_url: asset.image_url,
          mimetype: asset.mimetype,
          media_type: media?.media_type || null,
          clip_duration_seconds: media?.duration_seconds ?? null,
          created_by: asset.post?.created_by ?? null,
          group_id: asset.post?.group_id ?? null,
        };
      });
    const filterPiAssets = (piAssets, trackedRows) => {
      if (allowedGroupIds === null) return piAssets;
      const visibleIds = new Set(
        visibleTracked(trackedRows).map((t) => t.asset_id),
      );
      return (piAssets || []).filter((a) => visibleIds.has(a.asset_id));
    };
    const result = await sendSignageCommand(device.id, { action: "list" });
    if (result.ok) {
      await syncSignageAssetList(prisma, device.id, result.assets);
      const trackedRows = await prisma.signageAsset.findMany({
        where: { device_id: device.id },
        include: {
          post: {
            select: {
              title: true,
              id: true,
              created_by: true,
              group_id: true,
              images: { orderBy: { order_index: "asc" }, take: 1 },
            },
          },
        },
        orderBy: { updated_at: "desc" },
      });
      return res.json({
        ...result,
        assets: filterPiAssets(result.assets, trackedRows),
        tracked_assets: mapTracked(trackedRows),
      });
    }
    const visibleStale =
      allowedGroupIds === null
        ? trackedAssets
        : trackedAssets.filter((a) =>
            a.post?.group_id != null && allowedGroupIds.includes(a.post.group_id),
          );
    res.json({
      ...result,
      stale: true,
      tracked_assets: mapTracked(trackedAssets),
      assets: visibleStale.map((asset) => ({
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
    const actor = await getActor(req.user);
    const device = await getAllowedDevice(req, res);
    if (!device) return;

    const { command, asset_id } = req.body;
    if (!["next", "previous", "start"].includes(command)) {
      return res.status(400).json({ error: "Invalid command" });
    }
    if (command === "start" && !asset_id) {
      return res.status(400).json({ error: "asset_id is required" });
    }

    const lock = assertControlAllowed(actor, device);
    if (!lock.ok) return res.status(403).json({ error: lock.error });

    if (command === "start" && asset_id) {
      const perm = await assertCanManageAsset(actor, device.id, asset_id);
      if (!perm.ok) return res.status(403).json({ error: perm.error });
    }

    const result = await sendSignageCommand(device.id, {
      action: command,
      asset_id,
    });
    if (result.ok) {
        await applyControlLock(actor, device.id, command);
    }
    res.status(result.ok ? 200 : 503).json(result);
  },
);

// Hide/show a display asset without deleting it from Anthias.
router.patch(
  "/devices/:device_id/assets/:asset_id",
  auth(["admin", "creator"]),
  async (req, res) => {
    const actor = await getActor(req.user);
    const device = await getAllowedDevice(req, res);
    if (!device) return;

    const lock = assertControlAllowed(actor, device);
    if (!lock.ok) return res.status(403).json({ error: lock.error });

    const perm = await assertCanManageAsset(actor, device.id, req.params.asset_id);
    if (!perm.ok) return res.status(403).json({ error: perm.error });

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
      await applyControlLock(actor, device.id, enabled ? "show_asset" : "hide_asset");
    }
    res.status(result.ok ? 200 : 503).json(result);
  },
);

// Permanently delete an asset from Anthias.
router.delete(
  "/devices/:device_id/assets/:asset_id",
  auth(["admin", "creator"]),
  async (req, res) => {
    const actor = await getActor(req.user);
    const device = await getAllowedDevice(req, res);
    if (!device) return;

    const lock = assertControlAllowed(actor, device);
    if (!lock.ok) return res.status(403).json({ error: lock.error });

    const assetId = String(req.params.asset_id);

    const perm = await assertCanManageAsset(actor, device.id, assetId);
    if (!perm.ok) return res.status(403).json({ error: perm.error });

    const trackedAsset = perm.tracked;

    // Notify the Pi to delete from local Anthias
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

        // If no more deployments for this post, clear signage flag on the post.
        const remainingDeployments = await prisma.signageDeployment.count({
          where: { post_id: trackedAsset.post_id },
        });
        if (remainingDeployments === 0) {
          await prisma.post.update({
            where: { id: trackedAsset.post_id },
            data: { allowed_on_signage: false, requested_signage: false },
          });
        }
      }
      await applyControlLock(actor, device.id, "delete_asset");
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
