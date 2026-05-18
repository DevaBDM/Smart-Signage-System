const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
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

router.post("/", auth(["admin"]), asyncHandler(async (req, res) => {
  const { name, description, signage_state } = req.body;
  const parsedState = signage_state ? parseSignageState(signage_state) : "NORMAL";
  if (signage_state && !parsedState) {
    return res.status(400).json({ error: "Invalid signage_state" });
  }
  try {
    const group = await prisma.group.create({
      data: {
        name,
        description: description || null,
        signage_state: parsedState || "NORMAL",
      },
    });
    res.json(group);
  } catch (e) {
    if (e.code === "P2002") {
      throw Object.assign(new Error("Group name already exists."), { statusCode: 400 });
    }
    throw e;
  }
}));

router.put("/:id", auth(["admin"]), asyncHandler(async (req, res) => {
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
      throw Object.assign(new Error("Group name already exists."), { statusCode: 400 });
    }
    throw e;
  }
}));

router.delete("/:id", auth(["admin"]), asyncHandler(async (req, res) => {
  try {
    await prisma.group.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch {
    throw Object.assign(
      new Error("Group is still used by users, displays, posts, or playlists."),
      { statusCode: 400 },
    );
  }
}));

module.exports = router;
