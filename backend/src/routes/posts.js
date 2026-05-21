const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { uploadMedia } = require("../middleware/upload");
const { createPost, updatePost, removePost, bulkAction } = require("../services/postService");
const { getActor, getActorGroupIds } = require("../utils/permissions");
const { toBool } = require("../utils/parsers");
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
      live_stream: true,
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

// GET single post — public for published feed posts; auth required otherwise
router.get("/:id", async (req, res, next) => {
  const post = await prisma.post.findUnique({
    where: { id: Number(req.params.id) },
    include: { author: true, images: true, signage_metadata: true, signage_deployments: true, live_stream: true },
  });
  if (!post) return res.status(404).json({ error: "Not found" });

  // Public access: only published posts allowed on feed
  if (!req.user) {
    if (post.status === "published" && post.allowed_on_feed) {
      return res.json(post);
    }
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Authenticated access
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
  const result = await createPost(req.user, req.body, req.files, piBridge.getEmitter());
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
  const result = await bulkAction(actor, req.body, piBridge.getEmitter());
  res.json(result);
}));

module.exports = router;
