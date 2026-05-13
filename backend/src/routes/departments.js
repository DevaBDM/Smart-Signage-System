const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");

router.get("/", auth(["admin"]), async (req, res) => {
  res.json(await prisma.department.findMany());
});

router.post("/", auth(["admin"]), async (req, res) => {
  const { name } = req.body;
  try {
    res.json(await prisma.department.create({ data: { name } }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id", auth(["admin"]), async (req, res) => {
  await prisma.department.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

module.exports = router;
