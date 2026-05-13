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
      department: true,
      created_at: true,
    },
    orderBy: { created_at: "desc" },
  });
  res.json(users);
});

router.put("/:id", auth(["admin"]), async (req, res) => {
  const { role, department_id } = req.body;
  try {
    const user = await prisma.user.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(role && { role }),
        department_id: department_id ? Number(department_id) : null,
      },
      select: {
        id: true,
        username: true,
        role: true,
        department_id: true,
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
