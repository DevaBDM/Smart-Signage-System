const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");

router.get("/", auth(["admin"]), async (req, res) => {
  res.json(
    await prisma.group.findMany({
      include: {
        _count: {
          select: {
            users: true,
            devices: true,
            device_memberships: true,
            posts: true,
            playlists: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  );
});

router.post("/", auth(["admin"]), async (req, res) => {
  const { name, description } = req.body;
  try {
    res.json(
      await prisma.group.create({
        data: { name, description: description || null },
      }),
    );
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(400).json({ error: "Group name already exists." });
    }
    res.status(400).json({ error: e.message });
  }
});

router.put("/:id", auth(["admin"]), async (req, res) => {
  const { name, description } = req.body;
  try {
    res.json(
      await prisma.group.update({
        where: { id: Number(req.params.id) },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description: description || null }),
        },
      }),
    );
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(400).json({ error: "Group name already exists." });
    }
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id", auth(["admin"]), async (req, res) => {
  try {
    await prisma.group.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch {
    res.status(400).json({
      error:
        "Group is still used by users, displays, posts, or playlists.",
    });
  }
});

module.exports = router;
