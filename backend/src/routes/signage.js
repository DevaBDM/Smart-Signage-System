const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const {
  syncSignageAssetList,
} = require("../utils/signageAssets");
const { mediaFileExists } = require("../utils/mediaProcessor");
const {
  postVisibleForGroup,
  compareByUrgency,
} = require("../utils/signageStates");
const { getActor } = require("../utils/permissions");
const { assertControlAllowed, applyControlLock } = require("../utils/controlLock");
const { getAllowedDevice } = require("../utils/devicePermissions");
const { assertCanManageAsset } = require("../utils/signagePermissions");
const { publishPost, deleteDeviceAsset } = require("../services/signageService");
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
  try {
    const result = await publishPost(req.user, req.body);
    res.status(result.statusCode).json(result);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
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
    try {
      const actor = await getActor(req.user);
      const device = await getAllowedDevice(req, res);
      if (!device) return;

      const result = await deleteDeviceAsset(
        actor,
        device,
        req.params.asset_id,
        req.query.force === "true",
      );
      res.status(result.statusCode).json(result);
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message });
    }
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
