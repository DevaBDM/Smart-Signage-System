const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");

let _emitToDevice; // injected from index.js

router.use((req, _, next) => {
  _emitToDevice = req.app.get("emitToDevice");
  next();
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
  if (req.user.role !== "admin" && post.department_id !== req.user.department_id) {
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

  // Notify Pi via Socket.IO
  const pushed =
    _emitToDevice &&
    _emitToDevice(device_id, "playlist_update", {
      post_id: post.id,
      title: post.title,
      image_url: image?.image_path,
      duration_seconds: Number(duration_seconds) || 10,
      start_date: start_date || null,
      end_date: end_date || null,
    });

  res.json({ ok: true, pi_notified: !!pushed });
});

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
