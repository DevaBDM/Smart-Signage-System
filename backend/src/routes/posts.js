const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { uploadMedia } = require("../middleware/upload");
const { ensureDevicesOnline, getOnlineDeviceIdSet } = require("../utils/devices");
const { createPost, updatePost, removePost } = require("../services/postService");
const { deployPostToDevices } = require("../services/deploymentService");
const { getActor, getActorGroupIds, canManagePost } = require("../utils/permissions");
const { toBool, parseDeviceIds } = require("../utils/parsers");
const { deleteMediaFile } = require("../utils/mediaProcessor");
const piBridge = require("../services/piBridge");

// GET all posts
// Public listing is restricted to the feed channel; everything else requires auth and group scoping.
router.get("/", async (req, res, next) => {
  if (toBool(req.query.feed)) return next();
  return auth(["admin", "creator"])(req, res, next);
}, async (req, res) => {
  const { feed, group_id, status, channel, device_id, creator_id } = req.query;
  const where = {};
  if (toBool(feed)) {
    where.allowed_on_feed = true;
    where.status = "published";
  } else if (status) {
    where.status = status;
  }

  if (channel === "feed") {
    where.allowed_on_feed = true;
    where.allowed_on_signage = false;
  } else if (channel === "signage") {
    where.allowed_on_signage = true;
    where.allowed_on_feed = false;
  }

  // Scope non-admins to their primary + managed groups (unless they explicitly filter to one of those).
  if (req.user && req.user.role !== "admin") {
    const allowedGroupIds = getActorGroupIds(req.user);
    if (group_id && !isNaN(Number(group_id))) {
      const requested = Number(group_id);
      if (!allowedGroupIds.includes(requested)) {
        return res.json([]);
      }
      where.group_id = requested;
    } else {
      where.group_id = { in: allowedGroupIds.length ? allowedGroupIds : [-1] };
    }
  } else if (group_id && !isNaN(Number(group_id))) {
    where.group_id = Number(group_id);
  }
  if (creator_id && !isNaN(Number(creator_id))) {
    where.created_by = Number(creator_id);
  }
  if (device_id && !isNaN(Number(device_id))) {
    where.signage_deployments = {
      some: { device_id: Number(device_id) },
    };
  }
  const posts = await prisma.post.findMany({
    where,
    include: {
      author: { select: { id: true, username: true, auto_approve: true } },
      images: { orderBy: { order_index: "asc" } },
      signage_metadata: true,
      signage_deployments: true,
      group: true,
    },
    orderBy: { created_at: "desc" },
  });
  res.json(posts);
});

// Creators in the current group (for filters; not affected by post list filters).
router.get("/meta/group-creators", auth(["admin", "creator"]), async (req, res) => {
  const requestedGroupId = req.query.group_id ? Number(req.query.group_id) : null;
  const allowedGroupIds = getActorGroupIds(req.user);
  const groupId = req.user.role === "admin"
    ? requestedGroupId
    : allowedGroupIds?.includes(requestedGroupId)
      ? requestedGroupId
      : req.user.group_id;
  if (!groupId) return res.json([]);
  const users = await prisma.user.findMany({
    where: {
      role: "creator",
      OR: [
        { group_id: Number(groupId) },
        { managed_groups: { some: { group_id: Number(groupId) } } },
      ],
    },
    select: { id: true, username: true },
    orderBy: { username: "asc" },
  });
  res.json(users);
});

// GET single post
router.get("/:id", auth(["admin", "creator"]), async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: Number(req.params.id) },
    include: { author: true, images: true, signage_metadata: true, signage_deployments: true },
  });
  if (!post) return res.status(404).json({ error: "Not found" });
  if (req.user.role !== "admin") {
    const allowedGroupIds = getActorGroupIds(req.user);
    if (!allowedGroupIds.includes(post.group_id)) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }
  res.json(post);
});

// POST create post
router.post("/", auth(["admin", "creator"]), uploadMedia, asyncHandler(async (req, res) => {
  const result = await createPost(req.user, req.body, req.files);
  res.json(result);
}));

// PUT update post
router.put("/:id", auth(["admin", "creator"]), uploadMedia, asyncHandler(async (req, res) => {
  const updated = await updatePost(req.user, Number(req.params.id), req.body, req.files, piBridge.getEmitter());
  res.json(updated);
}));

// DELETE post
router.delete("/:id", auth(["admin", "creator"]), asyncHandler(async (req, res) => {
  const result = await removePost(req.user, Number(req.params.id), piBridge.getEmitter());
  res.json(result);
}));

// BULK ACTIONS
router.post("/bulk-action", auth(["admin", "creator"]), asyncHandler(async (req, res) => {
  const actor = await getActor(req.user);
  const { ids, action, device_ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "No IDs provided" });
  const selectedDeviceIds = parseDeviceIds(device_ids);
  
  const where = { id: { in: ids.map(Number) } };
  if (actor.role !== "admin") {
    const allowedGroupIds = getActorGroupIds(actor);
    where.group_id = { in: allowedGroupIds };
  }
  const posts = await prisma.post.findMany({
    where,
    include: { images: true, signage_metadata: true, signage_deployments: true, author: true }
  });

  const validIds = posts.filter(p => canManagePost(actor, p)).map(p => p.id);
  if (validIds.length === 0 && posts.length > 0) {
      return res.status(403).json({ error: "You do not have permission to perform this action on these posts." });
  }

  const emitter = piBridge.getEmitter();

  if (action === "delete") {
    await prisma.playlistItem.deleteMany({ where: { post_id: { in: validIds } } });
    for (const p of posts) {
      if (!validIds.includes(p.id)) continue;
      if (emitter) {
        const bulkDelOnline = await getOnlineDeviceIdSet(
          prisma,
          p.signage_deployments.map((d) => d.device_id),
        );
        for (const d of p.signage_deployments) {
          if (!bulkDelOnline.has(d.device_id)) continue;
          await emitter(d.device_id, "signage_command", { action: "delete_post_assets", post_id: p.id }, 2000).catch(() => {});
        }
      }
      for (const img of p.images) {
        deleteMediaFile(img.image_path);
      }
    }
    await prisma.post.deleteMany({ where: { id: { in: validIds } } });
  } 
  else if (action === "remove-signage") {
    if (emitter) {
      const deps = await prisma.signageDeployment.findMany({ where: { post_id: { in: validIds } } });
      const rsOnline = await getOnlineDeviceIdSet(
        prisma,
        deps.map((d) => d.device_id),
      );
      for (const dep of deps) {
        if (!rsOnline.has(dep.device_id)) continue;
        await emitter(dep.device_id, "signage_command", { action: "delete_post_assets", post_id: dep.post_id }, 2000).catch(() => {});
      }
    }
    await prisma.signageAsset.deleteMany({ where: { post_id: { in: validIds } } });
    await prisma.post.updateMany({
      where: { id: { in: validIds } },
      data: { allowed_on_signage: false, requested_signage: false },
    });
  }
  else if (action === "remove-feed") {
    await prisma.post.updateMany({
      where: { id: { in: validIds } },
      data: { allowed_on_feed: false, requested_feed: false },
    });
  }
  else if (action === "add-feed") {
    for (const p of posts) {
       if (!validIds.includes(p.id)) continue;
       const isAutoApprove = p.author?.auto_approve || actor.role === 'admin';
       await prisma.post.update({
         where: { id: p.id },
         data: { 
           requested_feed: true, 
           allowed_on_feed: isAutoApprove, 
         }
       });
    }
  }
  else if (action === "add-signage" || action === "add-both") {
    const publishFeed = action === "add-both";
    const unionTargets = new Set();
    for (const p of posts) {
      if (!validIds.includes(p.id)) continue;
      const t =
        selectedDeviceIds.length > 0
          ? selectedDeviceIds
          : p.signage_deployments.map((d) => d.device_id);
      t.forEach((id) => unionTargets.add(id));
    }
    const unionArr = [...unionTargets];
    if (unionArr.length > 0) {
      const chk = await ensureDevicesOnline(prisma, unionArr);
      if (!chk.ok) return res.status(400).json({ error: chk.error });
    }
    for (const p of posts) {
      if (!validIds.includes(p.id)) continue;
      const isAutoApprove = p.author?.auto_approve || actor.role === 'admin';
      const updated = await prisma.post.update({
        where: { id: p.id },
        data: { 
          requested_signage: true, 
          allowed_on_signage: isAutoApprove,
          ...(publishFeed && { requested_feed: true, allowed_on_feed: isAutoApprove }) 
        },
        include: { images: true, signage_metadata: true }
      });
      const targetIds = selectedDeviceIds.length > 0 ? selectedDeviceIds : p.signage_deployments.map(d => d.device_id);
      if (targetIds.length > 0) {
        const targetDevices = await prisma.device.findMany({ where: { id: { in: targetIds } } });
        await deployPostToDevices(
          piBridge.getEmitter(),
          actor,
          updated,
          targetDevices,
          updated.signage_metadata || {},
        );
      }
    }
  }
  res.json({ ok: true, count: validIds.length });
}));

module.exports = router;
