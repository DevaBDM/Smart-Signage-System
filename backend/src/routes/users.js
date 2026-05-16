// src/routes/users.js
const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");

router.get("/", auth(["admin"]), async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      department_id: true,
      auto_approve: true,
      can_manage_other_posts: true,
      creator_priority: true,
      control_lock_minutes: true,
      department: true,
      created_at: true,
    },
    orderBy: { created_at: "desc" },
  });
  res.json(users);
});

router.put("/:id", auth(["admin"]), async (req, res) => {
  const {
    role,
    department_id,
    auto_approve,
    can_manage_other_posts,
    creator_priority,
    control_lock_minutes,
  } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(role && { role }),
        department_id: department_id !== undefined ? (department_id ? Number(department_id) : null) : undefined,
        auto_approve: auto_approve !== undefined ? Boolean(auto_approve) : undefined,
        can_manage_other_posts:
          can_manage_other_posts !== undefined
            ? Boolean(can_manage_other_posts)
            : undefined,
        creator_priority:
          creator_priority !== undefined
            ? Math.max(1, Number(creator_priority) || 1)
            : undefined,
        control_lock_minutes:
          control_lock_minutes !== undefined
            ? Math.max(1, Number(control_lock_minutes) || 120)
            : undefined,
      },
      select: {
        id: true,
        username: true,
        role: true,
        department_id: true,
        auto_approve: true,
        can_manage_other_posts: true,
        creator_priority: true,
        control_lock_minutes: true,
        department: true,
        created_at: true,
      },
    });
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id", auth(["admin"]), async (req, res) => {
  await prisma.user.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

module.exports = router;
