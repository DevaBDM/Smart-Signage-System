const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

router.get("/", auth(["admin", "creator"]), async (req, res) => {
  const where =
    req.user.role === "admin" ? {} : { group_id: req.user.group_id };
  const playlists = await prisma.playlist.findMany({
    where,
    include: {
      items: { include: { post: { include: { images: true } } }, orderBy: { order_index: "asc" } },
      group: true,
    },
    orderBy: { created_at: "desc" },
  });
  res.json(playlists);
});

router.post("/", auth(["admin", "creator"]), asyncHandler(async (req, res) => {
  const { name, group_id, postIds } = req.body;
  const g_id =
    req.user.role === "admin" ? Number(group_id) : req.user.group_id;

  const playlist = await prisma.playlist.create({
    data: {
      name,
      group_id: g_id,
      items: {
        create: (postIds || []).map((id, index) => ({
          post_id: Number(id),
          order_index: index,
        })),
      },
    },
    include: { items: true },
  });
  res.json(playlist);
}));

router.put("/:id", auth(["admin", "creator"]), async (req, res) => {
  const { name, items } = req.body; // items: [{post_id, duration_seconds, order_index}]
  const existing = await prisma.playlist.findUnique({
    where: { id: Number(req.params.id) },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (
    req.user.role !== "admin" &&
    existing.group_id !== req.user.group_id
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (items?.length) {
    const postIds = items.map((i) => Number(i.post_id));
    const allowedPosts = await prisma.post.count({
      where: { id: { in: postIds }, group_id: existing.group_id },
    });
    if (allowedPosts !== new Set(postIds).size) {
      return res.status(403).json({ error: "Playlist contains invalid posts" });
    }
  }

  const playlist = await prisma.playlist.update({
    where: { id: Number(req.params.id) },
    data: { name },
  });
  if (items) {
    await prisma.playlistItem.deleteMany({
      where: { playlist_id: playlist.id },
    });
    await prisma.playlistItem.createMany({
      data: items.map((i) => ({
        playlist_id: playlist.id,
        post_id: Number(i.post_id),
        duration_seconds: Number(i.duration_seconds) || 10,
        order_index: Number(i.order_index) || 0,
      })),
    });
  }
  res.json(playlist);
});

router.delete("/:id", auth(["admin", "creator"]), async (req, res) => {
  const existing = await prisma.playlist.findUnique({
    where: { id: Number(req.params.id) },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (
    req.user.role !== "admin" &&
    existing.group_id !== req.user.group_id
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  await prisma.playlist.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

module.exports = router;
