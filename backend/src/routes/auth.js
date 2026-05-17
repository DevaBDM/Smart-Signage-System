const router = require("express").Router();
const prisma = require("../db/prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");
const { parseSignageState } = require("../utils/signageStates");

const parseGroupIds = (value) => {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) return parsed.map(Number).filter(Number.isFinite);
  } catch {}
  return String(value)
    .split(",")
    .map((s) => Number(s.trim()))
    .filter(Number.isFinite);
};

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

    const managedGroupIds = parseGroupIds(req.body.managed_group_ids);
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
        ...(managedGroupIds.length > 0 && {
          managed_groups: {
            create: managedGroupIds.map((gid) => ({ group_id: gid })),
          },
        }),
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
      managed_group_ids: managedGroupIds,
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
  const user = await prisma.user.findUnique({
    where: { username },
    include: { managed_groups: { select: { group_id: true } } },
  });
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const managedGroupIds = (user.managed_groups || []).map((g) => g.group_id);
  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      group_id: user.group_id,
      can_manage_other_posts: user.can_manage_other_posts,
      creator_priority: user.creator_priority,
      control_lock_minutes: user.control_lock_minutes,
      max_signage_state: user.max_signage_state,
      managed_group_ids: managedGroupIds,
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
    managed_group_ids: managedGroupIds,
  });
});

module.exports = router;
