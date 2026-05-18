const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../src/db/prisma");
const { UPLOAD_ROOT } = require("../src/utils/mediaProcessor");
const { buildUserPayload } = require("../src/services/authService");

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

async function createGroup(data = {}) {
  return prisma.group.create({
    data: {
      name: `Group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...data,
    },
  });
}

async function createUser({
  username,
  password = "password123",
  role = "creator",
  group_id = null,
  auto_approve = true,
  can_manage_other_posts = false,
  creator_priority = 1,
  control_lock_minutes = 120,
  max_signage_state = "NORMAL",
  managed_group_ids = [],
} = {}) {
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username:
        username || `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      password_hash: hash,
      role,
      group_id,
      auto_approve,
      can_manage_other_posts,
      creator_priority,
      control_lock_minutes,
      max_signage_state,
    },
  });

  if (managed_group_ids.length > 0) {
    await prisma.userGroup.createMany({
      data: managed_group_ids.map((gid) => ({
        user_id: user.id,
        group_id: gid,
      })),
    });
  }

  const token = jwt.sign(
    buildUserPayload({ ...user, managed_groups: managed_group_ids.map((id) => ({ group_id: id })) }),
    JWT_SECRET,
    { expiresIn: "1h" },
  );

  return { user, token, password };
}

async function createPost({
  title = "Test Post",
  group_id,
  created_by,
  status = "draft",
  allowed_on_feed = false,
  allowed_on_signage = false,
  signage_state = "NORMAL",
} = {}) {
  return prisma.post.create({
    data: {
      title,
      slug: `test-post-${Date.now()}`,
      group_id,
      created_by,
      status,
      allowed_on_feed,
      allowed_on_signage,
      signage_state,
      signage_metadata: {
        create: {
          duration_seconds: 10,
          priority: 1,
          is_enabled: true,
        },
      },
    },
    include: { images: true, signage_metadata: true },
  });
}

/** Create a dummy image file on disk and a PostImage row. */
async function createPostImage(postId, overrides = {}) {
  const filename = `test-${Date.now()}.png`;
  const absPath = path.resolve(UPLOAD_ROOT, "images", filename);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  // Write a minimal 1x1 PNG header (not a real PNG, but enough for fs.existsSync)
  fs.writeFileSync(absPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  const imagePath = `/uploads/images/${filename}`;
  const image = await prisma.postImage.create({
    data: {
      post_id: postId,
      image_path: imagePath,
      media_type: "IMAGE",
      duration_seconds: 10,
      ...overrides,
    },
  });
  return { image, absPath };
}

async function createDevice({
  device_name = "Test Pi",
  pending_name = null,
  pending_ip = null,
  pending_location = null,
  group_id = null,
  ip_address = "192.168.1.100",
  is_approved = true,
  status = "offline",
} = {}) {
  return prisma.device.create({
    data: {
      device_name,
      pending_name,
      pending_ip,
      pending_location,
      group_id,
      ip_address,
      is_approved,
      status,
    },
  });
}

module.exports = {
  prisma,
  createGroup,
  createUser,
  createPost,
  createPostImage,
  createDevice,
  JWT_SECRET,
};
