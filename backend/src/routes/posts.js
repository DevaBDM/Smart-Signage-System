const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { uploadMedia } = require("../middleware/upload");
const { uploadAttachments } = require("../middleware/uploadAttachment");
const { createPost, updatePost, removePost, bulkAction } = require("../services/postService");
const { getActor, getActorGroupIds, canManagePost } = require("../utils/permissions");
const { toBool } = require("../utils/parsers");
const { resolvePublicPath } = require("../utils/mediaProcessor");
const { extractText } = require("../utils/textExtractor");
const piBridge = require("../services/piBridge");
const fs = require("fs");
const path = require("path");

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
      attachments: { orderBy: { created_at: "asc" } },
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
  // Best-effort auth: populate req.user if a valid Bearer token is sent,
  // but allow anonymous fallthrough for public-feed posts below.
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (token) {
    try {
      req.user = require("jsonwebtoken").verify(token, process.env.JWT_SECRET);
    } catch { /* ignore — treat as anonymous */ }
  }

  const post = await prisma.post.findUnique({
    where: { id: Number(req.params.id) },
    include: { author: true, images: true, signage_metadata: true, signage_deployments: true, live_stream: true, attachments: true },
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

// ─── ATTACHMENTS ────────────────────────────────────────────────────────────

// POST upload attachments to a post (admin/creator who can manage the post)
router.post(
  "/:id/attachments",
  auth(["admin", "creator"]),
  uploadAttachments,
  asyncHandler(async (req, res) => {
    const postId = Number(req.params.id);
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (!canManagePost(req.user, post)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const existingCount = await prisma.postAttachment.count({ where: { post_id: postId } });
    const files = req.files || [];
    if (existingCount + files.length > 5) {
      // Clean up rejected temp files
      for (const f of files) {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      }
      return res.status(400).json({ error: "Max 5 attachments per post" });
    }

    const created = [];
    for (const file of files) {
      const publicPath = `/uploads/attachments/${path.basename(file.path)}`;
      const extracted = await extractText(file.path, file.mimetype);
      const record = await prisma.postAttachment.create({
        data: {
          post_id: postId,
          file_path: publicPath,
          file_name: file.originalname,
          mime_type: file.mimetype || "application/octet-stream",
          file_size: file.size || 0,
          extracted_text: extracted,
        },
      });
      created.push(record);
    }

    res.json({ created, count: created.length });
  }),
);

// GET attachments for a post
// Public for published feed posts; otherwise requires auth + group scope
router.get("/:id/attachments", async (req, res, next) => {
  const post = await prisma.post.findUnique({
    where: { id: Number(req.params.id) },
    select: { status: true, allowed_on_feed: true, group_id: true },
  });
  if (!post) return res.status(404).json({ error: "Post not found" });

  // Public access
  if (post.status === "published" && post.allowed_on_feed) return next();

  // Otherwise auth required
  return auth(["admin", "creator"])(req, res, next);
}, asyncHandler(async (req, res) => {
  if (req.user && req.user.role !== "admin") {
    const allowedGroupIds = getActorGroupIds(req.user);
    const post = await prisma.post.findUnique({
      where: { id: Number(req.params.id) },
      select: { group_id: true },
    });
    if (!allowedGroupIds.includes(post.group_id)) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  const attachments = await prisma.postAttachment.findMany({
    where: { post_id: Number(req.params.id) },
    orderBy: { created_at: "asc" },
  });
  res.json(attachments);
}));

// DELETE an attachment (admin/creator who can manage the post)
router.delete(
  "/:id/attachments/:attachment_id",
  auth(["admin", "creator"]),
  asyncHandler(async (req, res) => {
    const postId = Number(req.params.id);
    const attachmentId = Number(req.params.attachment_id);
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (!canManagePost(req.user, post)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const attachment = await prisma.postAttachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment || attachment.post_id !== postId) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    const absPath = resolvePublicPath(attachment.file_path);
    if (absPath && fs.existsSync(absPath)) {
      try { fs.unlinkSync(absPath); } catch { /* ignore */ }
    }

    await prisma.postAttachment.delete({ where: { id: attachmentId } });
    res.json({ deleted: true });
  }),
);

module.exports = router;
