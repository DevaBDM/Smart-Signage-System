const userRepo = require("../repositories/userRepo");
const { parseSignageState, rankOf } = require("../utils/signageStates");
const { parseGroupIds } = require("../utils/parsers");
const { syncPostsToMaxSignageState } = require("./postService");

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

async function listUsers() {
  return userRepo.findUsers(userListSelect);
}

async function updateUser(id, body, emitter = null) {
  const {
    role,
    group_id,
    auto_approve,
    can_manage_other_posts,
    creator_priority,
    control_lock_minutes,
    max_signage_state,
  } = body;

  const parsedMaxState =
    max_signage_state !== undefined ? parseSignageState(max_signage_state) : undefined;
  if (max_signage_state !== undefined && !parsedMaxState) {
    throw Object.assign(new Error("Invalid max_signage_state"), { statusCode: 400 });
  }

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

  const managedGroupIds = parseGroupIds(body.managed_group_ids);

  // Capture old max_signage_state before transaction so we can detect downgrades after.
  const userBefore = await userRepo.findUserById(id, { max_signage_state: true });
  const oldMaxState = userBefore?.max_signage_state || "NORMAL";

  const result = await userRepo.transaction(async (tx) => {
    const me = await tx.user.findUnique({
      where: { id },
      select: { id: true, role: true, creator_priority: true },
    });
    if (!me) {
      throw Object.assign(new Error("Not found"), { statusCode: 404 });
    }

    // Apply non-priority field changes first.
    if (Object.values(baseData).some((v) => v !== undefined)) {
      await tx.user.update({ where: { id }, data: baseData });
    }

    const finalRoleEarly = role || me.role;
    const becameCreator = finalRoleEarly === "creator" && me.role !== "creator";
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
        // Non-creator: just store whatever was sent.
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

    return tx.user.findUnique({ where: { id }, select: userListSelect });
  });

  // Permission-Post Sync: if max_signage_state was downgraded, clean up the user's posts.
  if (parsedMaxState && rankOf(parsedMaxState) > rankOf(oldMaxState)) {
    await syncPostsToMaxSignageState(id, parsedMaxState, emitter);
  }

  return result;
}

async function removeUser(id, currentUserId) {
  if (currentUserId === id) {
    throw Object.assign(
      new Error("You cannot delete your own admin account."),
      { statusCode: 400 },
    );
  }
  await userRepo.deleteUser(id);
  return { ok: true };
}

module.exports = { listUsers, updateUser, removeUser, userListSelect };
