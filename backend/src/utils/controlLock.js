const prisma = require("../db/prisma");

const assertControlAllowed = (user, device) => {
  if (user.role === "admin") return { ok: true };
  const lockUntil = device.control_lock_until;
  const lockActive = lockUntil && lockUntil > new Date();
  const lockOwner = device.control_lock_user_id;
  const lockPriority = device.control_lock_priority || 0;
  const userPriority = user.creator_priority || 1;

  if (
    lockActive &&
    lockOwner &&
    lockOwner !== user.id &&
    lockPriority > userPriority
  ) {
    return {
      ok: false,
      error:
        `Display is locked by a higher-priority creator until ${lockUntil.toLocaleString()}.`,
    };
  }
  return { ok: true };
};

const applyControlLock = async (user, deviceId, action) => {
  if (user.role === "admin") return;
  const minutes = Math.max(1, Number(user.control_lock_minutes) || 120);
  await prisma.device.update({
    where: { id: deviceId },
    data: {
      control_lock_user_id: user.id,
      control_lock_priority: user.creator_priority || 1,
      control_lock_until: new Date(Date.now() + minutes * 60_000),
      control_lock_action: action,
    },
  });
};

module.exports = { assertControlAllowed, applyControlLock };
