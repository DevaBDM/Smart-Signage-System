const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
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

router.post("/register", requireAdminAfterFirstUser, asyncHandler(async (req, res) => {
  const payload = await registerUser(req.body);
  res.json(payload);
}));

router.get("/me", auth(), async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { managed_groups: { select: { group_id: true } } },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(buildUserPayload(user));
});

router.post("/login", asyncHandler(async (req, res) => {
  const payload = await authenticateUser(req.body.username, req.body.password);
  const token = generateToken(payload);
  res.json({ token, ...payload });
}));

module.exports = router;
