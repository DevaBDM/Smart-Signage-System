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
  const playlist = await prisma.playlist.update({
    where: { id: Number(req.params.id) },
    data: { name },
  });
  if (items) {
    await prisma.playlistItem.deleteMany({
      where: { playlist_id: playlist.id },
    });
    await prisma.playlistItem.createMany({
      data: items.map((i) => ({ ...i, playlist_id: playlist.id })),
    });
  }
  res.json(playlist);
});

router.delete("/:id", auth(["admin"]), async (req, res) => {
  await prisma.playlist.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

module.exports = router;
