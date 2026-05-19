const router = require("express").Router();
const prisma = require("../db/prisma");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const {
  registerUser,
  authenticateUser,
  buildUserPayload,
  generateToken,
} = require("../services/authService");

router.post("/register", asyncHandler(async (req, res) => {
  const bootstrapPayload = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1)`;
    const userCount = await tx.user.count();
    if (userCount === 0) {
      // Bootstrap: force admin role regardless of body
      const payload = await registerUser({ ...req.body, role: "admin" }, tx);
      return payload;
    }
    return null;
  });

  if (bootstrapPayload) {
    return res.json(bootstrapPayload);
  }

  // Not bootstrap — manually verify admin token
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Forbidden. Insufficient permissions." });
    }
    req.user = decoded;
  } catch (ex) {
    return res.status(401).json({ error: "Invalid token." });
  }

  const payload = await registerUser(req.body);
  res.json(payload);
}));

router.get("/me", auth(), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { managed_groups: { select: { group_id: true } } },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(buildUserPayload(user));
}));

router.post("/login", asyncHandler(async (req, res) => {
  const payload = await authenticateUser(req.body.username, req.body.password);
  const token = generateToken(payload);
  res.json({ token, ...payload });
}));

module.exports = router;
