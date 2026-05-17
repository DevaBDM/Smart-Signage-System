const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const { parseSignageState } = require("../utils/signageStates");

router.get("/", auth(["admin"]), async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      group_id: true,
      auto_approve: true,
      can_manage_other_posts: true,
      creator_priority: true,
      control_lock_minutes: true,
      max_signage_state: true,
      created_at: true,
      group: true,
    },
    orderBy: { created_at: "desc" },
  });
  res.json(users);
});

router.put("/:id", auth(["admin"]), async (req, res) => {
  const { 
    role, 
    group_id, 
    auto_approve, 
    can_manage_other_posts, 
    creator_priority, 
    control_lock_minutes,
    max_signage_state,
  } = req.body;

  const parsedMaxState =
    max_signage_state !== undefined ? parseSignageState(max_signage_state) : undefined;
  if (max_signage_state !== undefined && !parsedMaxState) {
    return res.status(400).json({ error: "Invalid max_signage_state" });
  }

  try {
    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(role && { role }),
        group_id: group_id !== undefined ? (group_id ? Number(group_id) : null) : undefined,
        auto_approve: auto_approve !== undefined ? Boolean(auto_approve) : undefined,
        can_manage_other_posts: can_manage_other_posts !== undefined ? Boolean(can_manage_other_posts) : undefined,
        creator_priority: creator_priority !== undefined ? Number(creator_priority) : undefined,
        control_lock_minutes: control_lock_minutes !== undefined ? Number(control_lock_minutes) : undefined,
        ...(parsedMaxState && { max_signage_state: parsedMaxState }),
      },
      select: {
        id: true,
        username: true,
        role: true,
        group_id: true,
        auto_approve: true,
        can_manage_other_posts: true,
        creator_priority: true,
        control_lock_minutes: true,
        max_signage_state: true,
        group: true,
      },
    });
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id", auth(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    // Admins cannot delete themselves
    if (req.user.id === id) {
        return res.status(400).json({ error: "You cannot delete your own admin account." });
    }
    await prisma.user.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
