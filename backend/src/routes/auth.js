const router = require("express").Router();
const prisma = require("../db/prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");
const { parseSignageState } = require("../utils/signageStates");

const requireAdminAfterFirstUser = async (req, res, next) => {
  const userCount = await prisma.user.count();
  if (userCount === 0) return next();
  return auth(["admin"])(req, res, next);
};

router.post("/register", requireAdminAfterFirstUser, async (req, res) => {
  const {
    username,
    password,
    role,
    group_id,
    auto_approve,
    can_manage_other_posts,
    creator_priority,
    control_lock_minutes,
    max_signage_state,
  } = req.body;

  const parsedMaxState = max_signage_state
    ? parseSignageState(max_signage_state)
    : "NORMAL";
  if (max_signage_state && !parsedMaxState) {
    return res.status(400).json({ error: "Invalid max_signage_state" });
  }
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  if (!["admin", "creator", "viewer"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    let assignedPriority = Number(creator_priority) || 0;
    if (role === "creator") {
      const agg = await prisma.user.aggregate({
        where: { role: "creator" },
        _max: { creator_priority: true },
      });
      assignedPriority = (agg._max.creator_priority || 0) + 1;
    }

    const user = await prisma.user.create({
      data: {
        username,
        password_hash: hash,
        role,
        group_id: group_id ? Number(group_id) : null,
        auto_approve: auto_approve !== undefined ? Boolean(auto_approve) : true,
        can_manage_other_posts: Boolean(can_manage_other_posts),
        creator_priority: assignedPriority,
        control_lock_minutes: Number(control_lock_minutes) || 120,
        max_signage_state: parsedMaxState || "NORMAL",
      },
    });
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      auto_approve: user.auto_approve,
      can_manage_other_posts: user.can_manage_other_posts,
      creator_priority: user.creator_priority,
      control_lock_minutes: user.control_lock_minutes,
      max_signage_state: user.max_signage_state,
    });
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(400).json({ error: "Username already exists." });
    }
    res.status(400).json({ error: e.message });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      group_id: user.group_id,
      can_manage_other_posts: user.can_manage_other_posts,
      creator_priority: user.creator_priority,
      control_lock_minutes: user.control_lock_minutes,
      max_signage_state: user.max_signage_state,
    },
    process.env.JWT_SECRET,
    { expiresIn: "8h" },
  );
  res.json({
    token,
    role: user.role,
    group_id: user.group_id,
    can_manage_other_posts: user.can_manage_other_posts,
    creator_priority: user.creator_priority,
    control_lock_minutes: user.control_lock_minutes,
    max_signage_state: user.max_signage_state,
  });
});

module.exports = router;
