const prisma = require("../db/prisma");

function create(data) {
  return prisma.liveStream.create({ data });
}

function findById(id) {
  return prisma.liveStream.findUnique({
    where: { id },
    include: { group: true, author: true },
  });
}

function findByGroupIds(groupIds) {
  return prisma.liveStream.findMany({
    where: { group_id: { in: groupIds } },
    orderBy: { created_at: "desc" },
  });
}

function update(id, data) {
  return prisma.liveStream.update({
    where: { id },
    data,
  });
}

function remove(id) {
  return prisma.liveStream.delete({ where: { id } });
}

function findPublishedPostsUsingStream(liveStreamId) {
  return prisma.post.findMany({
    where: {
      live_stream_id: liveStreamId,
      status: "published",
      allowed_on_signage: true,
    },
  });
}

module.exports = {
  create,
  findById,
  findByGroupIds,
  update,
  remove,
  findPublishedPostsUsingStream,
};
