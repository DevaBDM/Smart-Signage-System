const prisma = require("../db/prisma");

const findUsers = (select) =>
  prisma.user.findMany({ select, orderBy: { created_at: "desc" } });

const findUserById = (id, select = {}) =>
  prisma.user.findUnique({ where: { id: Number(id) }, select });

const updateUser = (id, data) =>
  prisma.user.update({ where: { id: Number(id) }, data });

const deleteUser = (id) =>
  prisma.user.delete({ where: { id: Number(id) } });

const deleteUserGroups = (userId) =>
  prisma.userGroup.deleteMany({ where: { user_id: Number(userId) } });

const createUserGroups = (data) =>
  prisma.userGroup.createMany({ data });

const findCollidingCreator = (priority, excludeId) =>
  prisma.user.findFirst({
    where: { role: "creator", creator_priority: priority, NOT: { id: excludeId } },
    select: { id: true, creator_priority: true },
  });

const getMaxCreatorPriority = (excludeId) =>
  prisma.user.aggregate({
    where: { role: "creator", NOT: { id: excludeId } },
    _max: { creator_priority: true },
  });

const transaction = (fn) => prisma.$transaction(fn);

module.exports = {
  findUsers,
  findUserById,
  updateUser,
  deleteUser,
  deleteUserGroups,
  createUserGroups,
  findCollidingCreator,
  getMaxCreatorPriority,
  transaction,
};
