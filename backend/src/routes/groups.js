const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const { parseSignageState, STATE_LABELS } = require("../utils/signageStates");
const { refreshGroupDevices } = require("../utils/refreshGroupDevices");

router.get("/states", (_req, res) => {
  res.json({
    states: Object.entries(STATE_LABELS).map(([value, label]) => ({ value, label })),
  });
});

router.get("/", auth(["admin", "creator"]), async (req, res) => {
  const where =
    req.user.role === "admin"
      ? {}
      : {
          id: {
            in: [
              req.user.group_id,
              ...(req.user.managed_group_ids || []),
            ].filter(Boolean),
          },
        };
  res.json(
    await prisma.group.findMany({
      where,
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
  const { name, description, signage_state } = req.body;
  const parsedState = signage_state ? parseSignageState(signage_state) : "NORMAL";
  if (signage_state && !parsedState) {
    return res.status(400).json({ error: "Invalid signage_state" });
  }
  try {
    res.json(
      await prisma.group.create({
        data: {
          name,
          description: description || null,
          signage_state: parsedState || "NORMAL",
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

router.put("/:id", auth(["admin"]), async (req, res) => {
  const { name, description, signage_state } = req.body;
  const groupId = Number(req.params.id);
  const existing = await prisma.group.findUnique({ where: { id: groupId } });
  if (!existing) return res.status(404).json({ error: "Group not found" });

  const parsedState =
    signage_state !== undefined ? parseSignageState(signage_state) : undefined;
  if (signage_state !== undefined && !parsedState) {
    return res.status(400).json({ error: "Invalid signage_state" });
  }

  try {
    const updated = await prisma.group.update({
      where: { id: groupId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(parsedState && { signage_state: parsedState }),
      },
    });

    if (parsedState && parsedState !== existing.signage_state) {
      await refreshGroupDevices(req.app, groupId);
    }

    res.json(updated);
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
