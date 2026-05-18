const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const {
  registerUser,
  authenticateUser,
  buildUserPayload,
  generateToken,
} = require("../services/authService");

const requireAdminAfterFirstUser = async (req, res, next) => {
  const userCount = await prisma.user.count();
  if (userCount === 0) return next();
  return auth(["admin"])(req, res, next);
};

router.post("/register", requireAdminAfterFirstUser, async (req, res) => {
  try {
    const payload = await registerUser(req.body);
    res.json(payload);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

router.get("/me", auth(), async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { managed_groups: { select: { group_id: true } } },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(buildUserPayload(user));
});

router.post("/login", async (req, res) => {
  try {
    const payload = await authenticateUser(req.body.username, req.body.password);
    const token = generateToken(payload);
    res.json({ token, ...payload });
  } catch (err) {
    res.status(err.statusCode || 401).json({ error: err.message });
  }
});

module.exports = router;
