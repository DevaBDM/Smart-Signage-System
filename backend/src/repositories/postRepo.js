const prisma = require("../db/prisma");

const findUserById = (id) =>
  prisma.user.findUnique({ where: { id } });

const createPost = (data) =>
  prisma.post.create({ data, include: { images: true, signage_metadata: true } });

const findPostWithImagesAndAuthor = (id) =>
  prisma.post.findUnique({
    where: { id },
    include: { images: true, author: true },
  });

const findPostWithImages = (id) =>
  prisma.post.findUnique({
    where: { id },
    include: { images: true },
  });

const deletePostImages = (postId) =>
  prisma.postImage.deleteMany({ where: { post_id: postId } });

const createPostImages = (images) =>
  prisma.postImage.createMany({ data: images });

const findPostImages = (postId) =>
  prisma.postImage.findMany({
    where: { post_id: postId },
    orderBy: { order_index: "asc" },
  });

const upsertSignageMetadata = (postId, update, create) =>
  prisma.signageMetadata.upsert({
    where: { post_id: postId },
    update,
    create: { post_id: postId, ...create },
  });

const updatePost = (id, data) =>
  prisma.post.update({
    where: { id },
    data,
    include: { images: true, signage_metadata: true },
  });

const findAllDeploymentsForPost = (postId) =>
  prisma.signageDeployment.findMany({ where: { post_id: postId } });

const deleteSignageAssetsForPost = (postId) =>
  prisma.signageAsset.deleteMany({ where: { post_id: postId } });

const deleteSignageAssetsForDevice = (postId, deviceId) =>
  prisma.signageAsset.deleteMany({
    where: { post_id: postId, device_id: deviceId },
  });

const deleteDeployment = (postId, deviceId) =>
  prisma.signageDeployment.delete({
    where: { device_id_post_id: { device_id: deviceId, post_id: postId } },
  });

const deletePlaylistItemsForPost = (postId) =>
  prisma.playlistItem.deleteMany({ where: { post_id: postId } });

const deletePost = (id) =>
  prisma.post.delete({ where: { id } });

const findDevicesByIds = (ids) =>
  prisma.device.findMany({ where: { id: { in: ids } } });

module.exports = {
  findUserById,
  createPost,
  findPostWithImagesAndAuthor,
  findPostWithImages,
  deletePostImages,
  createPostImages,
  findPostImages,
  upsertSignageMetadata,
  updatePost,
  findAllDeploymentsForPost,
  deleteSignageAssetsForPost,
  deleteSignageAssetsForDevice,
  deleteDeployment,
  deletePlaylistItemsForPost,
  deletePost,
  findDevicesByIds,
};
