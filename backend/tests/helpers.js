const fs = require("fs");
const http = require("http");
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
  live_stream_id = null,
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
      ...(live_stream_id != null && { live_stream_id }),
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
  id,
  device_name = "Test Pi",
  pending_name = null,
  pending_ip = null,
  pending_location = null,
  group_id = null,
  ip_address = "192.168.1.100",
  is_approved = true,
  status = "offline",
  device_token = null,
} = {}) {
  return prisma.device.create({
    data: {
      ...(id !== undefined && { id }),
      device_name,
      pending_name,
      pending_ip,
      pending_location,
      group_id,
      ip_address,
      is_approved,
      status,
      device_token,
    },
  });
}

async function createLiveStream({
  title = "Test Stream",
  stream_type = "HLS",
  source_url = "http://example.com/stream.m3u8",
  group_id,
  created_by,
  thumbnail_path = null,
} = {}) {
  return prisma.liveStream.create({
    data: {
      title,
      stream_type,
      source_url,
      group_id,
      created_by,
      thumbnail_path,
    },
  });
}

/**
 * Create a real HTTP + Socket.IO server on a random port.
 * Returns { server, cleanup, ready } where `await ready` resolves to the port number.
 */
function createTestServer() {
  const initSocket = require("../src/websocket/socket");
  const app = require("../src/app");
  const server = http.createServer(app);
  const { emitToDeviceAck, cleanup } = initSocket(server);
  const piBridge = require("../src/services/piBridge");
  piBridge.setEmitter(emitToDeviceAck);
  const ready = new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(server.address().port);
    });
  });
  return { server, cleanup, ready };
}

/** Wait for a socket event with a timeout. */
function waitForEvent(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

module.exports = {
  prisma,
  createGroup,
  createUser,
  createPost,
  createPostImage,
  createDevice,
  createLiveStream,
  createTestServer,
  waitForEvent,
  JWT_SECRET,
};
