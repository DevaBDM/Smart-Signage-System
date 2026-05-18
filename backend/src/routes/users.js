const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const { parseSignageState } = require("../utils/signageStates");

const userListSelect = {
  id: true,
  username: true,
  role: true,
  group_id: true,
  auto_approve: true,
  can_manage_other_posts: true,
  creator_priority: true,
  control_lock_minutes: true,
  max_signage_state: true,
  created_at: true,
  group: true,
  managed_groups: { select: { group_id: true, group: true } },
};

router.get("/", auth(["admin"]), async (req, res) => {
  const users = await prisma.user.findMany({
    select: userListSelect,
    orderBy: { created_at: "desc" },
  });
  res.json(users);
});

const parseGroupIds = (value) => {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) return parsed.map(Number).filter(Number.isFinite);
  } catch {
    /* ignore parse errors */
  }
  return String(value)
    .split(",")
    .map((s) => Number(s.trim()))
    .filter(Number.isFinite);
};

router.put("/:id", auth(["admin"]), async (req, res) => {
  const {
    role,
    group_id,
    auto_approve,
    can_manage_other_posts,
    creator_priority,
    control_lock_minutes,
    max_signage_state,
  } = req.body;

  const parsedMaxState =
    max_signage_state !== undefined ? parseSignageState(max_signage_state) : undefined;
  if (max_signage_state !== undefined && !parsedMaxState) {
    return res.status(400).json({ error: "Invalid max_signage_state" });
  }

  const id = Number(req.params.id);
  const baseData = {
    ...(role && { role }),
    group_id: group_id !== undefined ? (group_id ? Number(group_id) : null) : undefined,
    auto_approve: auto_approve !== undefined ? Boolean(auto_approve) : undefined,
    can_manage_other_posts:
      can_manage_other_posts !== undefined ? Boolean(can_manage_other_posts) : undefined,
    control_lock_minutes:
      control_lock_minutes !== undefined ? Number(control_lock_minutes) : undefined,
    ...(parsedMaxState && { max_signage_state: parsedMaxState }),
  };

  const managedGroupIds = parseGroupIds(req.body.managed_group_ids);
  const select = userListSelect;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const me = await tx.user.findUnique({
        where: { id },
        select: { id: true, role: true, creator_priority: true },
      });
      if (!me) {
        const err = new Error("Not found");
        err.statusCode = 404;
        throw err;
      }

      // Apply non-priority field changes first.
      if (Object.values(baseData).some((v) => v !== undefined)) {
        await tx.user.update({ where: { id }, data: baseData });
      }

      const finalRoleEarly = role || me.role;
      const becameCreator =
        finalRoleEarly === "creator" && me.role !== "creator";
      if (becameCreator && creator_priority === undefined) {
        const agg = await tx.user.aggregate({
          where: { role: "creator", NOT: { id } },
          _max: { creator_priority: true },
        });
        await tx.user.update({
          where: { id },
          data: { creator_priority: (agg._max.creator_priority || 0) + 1 },
        });
      }

      if (creator_priority !== undefined) {
        const newPrio = Number(creator_priority);
        const finalRole = role || me.role;

        if (finalRole === "creator") {
          const collide = await tx.user.findFirst({
            where: {
              role: "creator",
              creator_priority: newPrio,
              NOT: { id },
            },
            select: { id: true, creator_priority: true },
          });

          if (collide) {
            // Three-step swap via sentinel so the pair never holds the same value.
            await tx.user.update({
              where: { id: collide.id },
              data: { creator_priority: 0 },
            });
            await tx.user.update({
              where: { id },
              data: { creator_priority: newPrio },
            });
            await tx.user.update({
              where: { id: collide.id },
              data: { creator_priority: me.creator_priority },
            });
          } else {
            await tx.user.update({
              where: { id },
              data: { creator_priority: newPrio },
            });
          }
        } else {
          // Non-creator: just store whatever was sent (priority is irrelevant for them).
          await tx.user.update({
            where: { id },
            data: { creator_priority: newPrio },
          });
        }
      }

      if (managedGroupIds !== null) {
        await tx.userGroup.deleteMany({ where: { user_id: id } });
        if (managedGroupIds.length > 0) {
          await tx.userGroup.createMany({
            data: managedGroupIds.map((gid) => ({
              user_id: id,
              group_id: gid,
            })),
          });
        }
      }

      return tx.user.findUnique({ where: { id }, select });
    });

    res.json(updated);
  } catch (e) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

router.delete("/:id", auth(["admin"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    // Admins cannot delete themselves
    if (req.user.id === id) {
        return res.status(400).json({ error: "You cannot delete your own admin account." });
    }
    await prisma.user.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
