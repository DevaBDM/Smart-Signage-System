const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../db/prisma");
const { parseSignageState } = require("../utils/signageStates");
const { parseGroupIds } = require("../utils/parsers");

const SALT_ROUNDS = 10;
const TOKEN_EXPIRES_IN = "8h";

function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Build the unified JWT / response payload from a Prisma user row.
 */
function buildUserPayload(user) {
  const managedGroupIds = (user.managed_groups || []).map((g) => g.group_id);
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    group_id: user.group_id,
    auto_approve: user.auto_approve,
    can_manage_other_posts: user.can_manage_other_posts,
    creator_priority: user.creator_priority,
    control_lock_minutes: user.control_lock_minutes,
    max_signage_state: user.max_signage_state,
    managed_group_ids: managedGroupIds,
  };
}

function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRES_IN,
  });
}

async function registerUser(body, tx) {
  const client = tx || prisma;
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
  } = body;

  const parsedMaxState = max_signage_state
    ? parseSignageState(max_signage_state)
    : "NORMAL";
  if (max_signage_state && !parsedMaxState) {
    throw Object.assign(new Error("Invalid max_signage_state"), {
      statusCode: 400,
    });
  }
  if (!username || !password) {
    throw Object.assign(new Error("Username and password are required"), {
      statusCode: 400,
    });
  }
  if (!["admin", "creator", "viewer"].includes(role)) {
    throw Object.assign(new Error("Invalid role"), { statusCode: 400 });
  }

  const hash = await hashPassword(password);
  let assignedPriority = Number(creator_priority) || 0;
  if (role === "creator") {
    const agg = await client.user.aggregate({
      where: { role: "creator" },
      _max: { creator_priority: true },
    });
    assignedPriority = (agg._max.creator_priority || 0) + 1;
  }

  const managedGroupIds = parseGroupIds(body.managed_group_ids);

  try {
    const user = await client.user.create({
      data: {
        username,
        password_hash: hash,
        role,
        group_id: group_id ? Number(group_id) : null,
        auto_approve: auto_approve !== undefined ? Boolean(auto_approve) : false,
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
      include: { managed_groups: { select: { group_id: true } } },
    });
    return buildUserPayload(user);
  } catch (e) {
    if (e.code === "P2002") {
      throw Object.assign(new Error("Username already exists."), {
        statusCode: 400,
      });
    }
    throw e;
  }
}

async function authenticateUser(username, password) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { managed_groups: { select: { group_id: true } } },
  });
  if (!user || !(await comparePassword(password, user.password_hash))) {
    throw Object.assign(new Error("Invalid credentials"), {
      statusCode: 401,
    });
  }
  return buildUserPayload(user);
}

module.exports = {
  hashPassword,
  comparePassword,
  buildUserPayload,
  generateToken,
  registerUser,
  authenticateUser,
};
