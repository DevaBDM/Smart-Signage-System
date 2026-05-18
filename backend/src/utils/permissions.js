const prisma = require("../db/prisma");

const canManage = (user, group_id) => {
  if (user.role === "admin") return true;
  const g = Number(group_id);
  if (user.group_id === g) return true;
  const managed = Array.isArray(user.managed_group_ids)
    ? user.managed_group_ids
    : [];
  return managed.includes(g);
};

const canManagePost = (user, post) => {
  if (user.role === "admin") return true;
  if (post.created_by === user.id) return true;
  if (!user.can_manage_other_posts) return false;
  const managed = Array.isArray(user.managed_group_ids)
    ? user.managed_group_ids
    : [];
  return user.group_id === post.group_id || managed.includes(post.group_id);
};

const getActor = async (user) => {
  if (user.role === "admin") return user;
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      role: true,
      group_id: true,
      can_manage_other_posts: true,
      creator_priority: true,
      control_lock_minutes: true,
      max_signage_state: true,
      managed_groups: { select: { group_id: true } },
    },
  });
  if (!dbUser) return user;
  return {
    ...dbUser,
    managed_group_ids: (dbUser.managed_groups || []).map((g) => g.group_id),
  };
};

module.exports = { canManage, canManagePost, getActor };
