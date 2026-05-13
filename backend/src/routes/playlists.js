const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");

router.get("/", auth(["admin", "creator"]), async (req, res) => {
  const where =
    req.user.role === "admin" ? {} : { department_id: req.user.department_id };
  res.json(
    await prisma.playlist.findMany({
      where,
      include: { items: { include: { post: true } } },
    }),
  );
});

router.post("/", auth(["admin", "creator"]), async (req, res) => {
  const { name, department_id } = req.body;
  const dept =
    req.user.role === "admin" ? Number(department_id) : req.user.department_id;
  res.json(
    await prisma.playlist.create({ data: { name, department_id: dept } }),
  );
});

router.put("/:id", auth(["admin", "creator"]), async (req, res) => {
  const { name, items } = req.body; // items: [{post_id, duration_seconds, order_index}]
  const existing = await prisma.playlist.findUnique({
    where: { id: Number(req.params.id) },
  });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (
    req.user.role !== "admin" &&
    existing.department_id !== req.user.department_id
  ) {
    return res.status(403).json({ error: "Cannot manage this playlist" });
  }

  if (items?.length) {
    const postIds = items.map((i) => Number(i.post_id));
    const allowedPosts = await prisma.post.count({
      where: { id: { in: postIds }, department_id: existing.department_id },
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

router.delete("/:id", auth(["admin"]), async (req, res) => {
  await prisma.playlist.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

module.exports = router;
