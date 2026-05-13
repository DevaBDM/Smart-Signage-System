const router = require("express").Router();
const prisma = require("../db/prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");

const requireAdminAfterFirstUser = async (req, res, next) => {
  const userCount = await prisma.user.count();
  if (userCount === 0) return next();
  return auth(["admin"])(req, res, next);
};

router.post("/register", requireAdminAfterFirstUser, async (req, res) => {
  const { username, password, role, department_id } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  if (!["admin", "creator", "viewer"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: {
        username,
        password_hash: hash,
        role,
        department_id: department_id ? Number(department_id) : null,
      },
    });
    res.json({ id: user.id, username: user.username, role: user.role });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: "Invalid credentials" });
  const token = jwt.sign(
    { id: user.id, role: user.role, department_id: user.department_id },
    process.env.JWT_SECRET,
    { expiresIn: "8h" },
  );
  res.json({ token, role: user.role, department_id: user.department_id });
});

module.exports = router;
