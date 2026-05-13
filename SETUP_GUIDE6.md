Let me read the updated project files first.Good. I can clearly see what changed from the original simple structure. Here's a full breakdown of what needs to be updated and the exact changes:

---

## What Changed vs What You Built

| Area        | Before (what you built) | Now (updated docs)                                                             |
| ----------- | ----------------------- | ------------------------------------------------------------------------------ |
| ORM         | Raw `pg` queries        | **Prisma ORM**                                                                 |
| Device comm | REST heartbeat          | **Socket.IO WebSocket**                                                        |
| DB schema   | Flat/simple             | Full schema with departments, playlists, signage_metadata, post_images         |
| Users       | No department           | `department_id` on users                                                       |
| Posts       | title + image + device  | title, slug, markdown, department, publish_to_feed, publish_to_signage, status |
| Devices     | No department           | `department_id`, `current_playlist`                                            |
| Sensor logs | generic type/value      | dedicated `motion`, `brightness`, `rain` columns                               |
| New tables  | —                       | DEPARTMENTS, POST_IMAGES, SIGNAGE_METADATA, PLAYLISTS, PLAYLIST_ITEMS          |
| Pi comm     | polling every 60s       | Socket.IO events (heartbeat, sensor_update, playlist_ack, etc.)                |

---

## STEP 1 — Install New Dependencies

```bash
cd WebServer/backend
npm install prisma @prisma/client socket.io
npm install -D prisma
npx prisma init
```

This creates `prisma/schema.prisma` and updates `.env` with `DATABASE_URL`.

---

## STEP 2 — Update `.env`

Replace the DB lines with the Prisma format:

```env
PORT=5000
DATABASE_URL="postgresql://signage_admin:yourpassword@localhost:5432/signage_db"
JWT_SECRET=your_super_secret_key_here
```

---

## STEP 3 — Full Prisma Schema (`prisma/schema.prisma`)

Replace the entire file:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Department {
  id         Int       @id @default(autoincrement())
  name       String    @unique
  created_at DateTime  @default(now())

  users      User[]
  devices    Device[]
  posts      Post[]
  playlists  Playlist[]
}

model User {
  id            Int        @id @default(autoincrement())
  username      String     @unique
  password_hash String
  role          Role       @default(creator)
  department    Department? @relation(fields: [department_id], references: [id])
  department_id Int?
  created_at    DateTime   @default(now())

  posts         Post[]
}

enum Role {
  admin
  creator
  viewer
}

model Post {
  id                   Int               @id @default(autoincrement())
  title                String
  slug                 String            @unique
  description_markdown String?
  department           Department        @relation(fields: [department_id], references: [id])
  department_id        Int
  created_by           Int
  author               User              @relation(fields: [created_by], references: [id])
  publish_to_feed      Boolean           @default(false)
  publish_to_signage   Boolean           @default(false)
  status               PostStatus        @default(draft)
  created_at           DateTime          @default(now())
  updated_at           DateTime          @updatedAt

  images               PostImage[]
  signage_metadata     SignageMetadata?
  playlist_items       PlaylistItem[]
}

enum PostStatus {
  draft
  published
}

model PostImage {
  id          Int      @id @default(autoincrement())
  post        Post     @relation(fields: [post_id], references: [id], onDelete: Cascade)
  post_id     Int
  image_path  String
  order_index Int      @default(0)
  created_at  DateTime @default(now())
}

model SignageMetadata {
  id               Int      @id @default(autoincrement())
  post             Post     @relation(fields: [post_id], references: [id], onDelete: Cascade)
  post_id          Int      @unique
  duration_seconds Int      @default(10)
  start_date       DateTime?
  end_date         DateTime?
  priority         Int      @default(1)
  display_group    String?
  created_at       DateTime @default(now())
}

model Device {
  id               Int        @id @default(autoincrement())
  device_name      String
  department       Department? @relation(fields: [department_id], references: [id])
  department_id    Int?
  ip_address       String     @unique
  status           String     @default("offline")
  last_seen        DateTime?
  current_playlist Int?
  created_at       DateTime   @default(now())

  sensor_logs      SensorLog[]
  error_logs       ErrorLog[]
}

model SensorLog {
  id         Int      @id @default(autoincrement())
  device     Device   @relation(fields: [device_id], references: [id])
  device_id  Int
  motion     Boolean  @default(false)
  brightness Int      @default(0)
  rain       Boolean  @default(false)
  created_at DateTime @default(now())
}

model ErrorLog {
  id         Int      @id @default(autoincrement())
  device     Device   @relation(fields: [device_id], references: [id])
  device_id  Int
  error_type String
  message    String
  created_at DateTime @default(now())
}

model Playlist {
  id            Int            @id @default(autoincrement())
  name          String
  department    Department     @relation(fields: [department_id], references: [id])
  department_id Int
  created_at    DateTime       @default(now())

  items         PlaylistItem[]
}

model PlaylistItem {
  id               Int      @id @default(autoincrement())
  playlist         Playlist @relation(fields: [playlist_id], references: [id], onDelete: Cascade)
  playlist_id      Int
  post             Post     @relation(fields: [post_id], references: [id])
  post_id          Int
  duration_seconds Int      @default(10)
  order_index      Int      @default(0)
}
```

Apply to DB:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

---

## STEP 4 — Replace DB Pool with Prisma Client (`src/db/prisma.js`)

Delete `src/db/pool.js` and create:

```js
// src/db/prisma.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
module.exports = prisma;
```

---

## STEP 5 — Updated Routes

**`src/routes/auth.js`**

```js
const router = require("express").Router();
const prisma = require("../db/prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

router.post("/register", async (req, res) => {
  const { username, password, role, department_id } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: {
        username,
        password_hash: hash,
        role,
        department_id: department_id || null,
      },
    });
    res.json({ id: user.id, username: user.username, role: user.role });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    return res.status(401).json({ error: "Invalid credentials" });
  const token = jwt.sign(
    { id: user.id, role: user.role, department_id: user.department_id },
    process.env.JWT_SECRET,
    { expiresIn: "8h" },
  );
  res.json({ token, role: user.role, department_id: user.department_id });
});

module.exports = router;
```

---

**`src/routes/departments.js`** ← new file

```js
const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");

router.get("/", auth(["admin"]), async (req, res) => {
  res.json(await prisma.department.findMany());
});

router.post("/", auth(["admin"]), async (req, res) => {
  const { name } = req.body;
  try {
    res.json(await prisma.department.create({ data: { name } }));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id", auth(["admin"]), async (req, res) => {
  await prisma.department.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

module.exports = router;
```

---

**`src/routes/posts.js`** — full rewrite with slugs, markdown, publish modes, multiple images:

```js
const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const storage = multer.diskStorage({
  destination: "uploads/images/",
  filename: (_, file, cb) =>
    cb(
      null,
      `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${path.extname(file.originalname)}`,
    ),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

// Slug helper
const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") +
  "-" +
  Date.now();

// Enforce department isolation for creators
const canManage = (user, department_id) =>
  user.role === "admin" || user.department_id === Number(department_id);

// GET all posts (public-safe, feed only returns published feed posts)
router.get("/", async (req, res) => {
  const { feed, department_id } = req.query;
  const where = {};
  if (feed === "true") where.publish_to_feed = true;
  if (feed === "true") where.status = "published";
  if (department_id) where.department_id = Number(department_id);
  const posts = await prisma.post.findMany({
    where,
    include: {
      images: { orderBy: { order_index: "asc" } },
      signage_metadata: true,
    },
    orderBy: { created_at: "desc" },
  });
  res.json(posts);
});

// GET single post by id
router.get("/:id", async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: Number(req.params.id) },
    include: { images: true, signage_metadata: true },
  });
  if (!post) return res.status(404).json({ error: "Not found" });
  res.json(post);
});

// POST create post with multiple images
router.post(
  "/",
  auth(["admin", "creator"]),
  upload.array("images", 10),
  async (req, res) => {
    const {
      title,
      description_markdown,
      department_id,
      publish_to_feed,
      publish_to_signage,
      status,
      duration_seconds,
      start_date,
      end_date,
      priority,
      display_group,
    } = req.body;

    if (!canManage(req.user, department_id))
      return res.status(403).json({ error: "Cannot manage this department" });

    try {
      const post = await prisma.post.create({
        data: {
          title,
          slug: slugify(title),
          description_markdown: description_markdown || null,
          department_id: Number(department_id),
          created_by: req.user.id,
          publish_to_feed: publish_to_feed === "true",
          publish_to_signage: publish_to_signage === "true",
          status: status || "draft",
          images: {
            create: (req.files || []).map((f, i) => ({
              image_path: `/uploads/images/${f.filename}`,
              order_index: i,
            })),
          },
          ...(publish_to_signage === "true" && {
            signage_metadata: {
              create: {
                duration_seconds: Number(duration_seconds) || 10,
                start_date: start_date ? new Date(start_date) : null,
                end_date: end_date ? new Date(end_date) : null,
                priority: Number(priority) || 1,
                display_group: display_group || null,
              },
            },
          }),
        },
        include: { images: true, signage_metadata: true },
      });
      res.json(post);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  },
);

// PUT update post
router.put("/:id", auth(["admin", "creator"]), async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: Number(req.params.id) },
  });
  if (!post) return res.status(404).json({ error: "Not found" });
  if (!canManage(req.user, post.department_id))
    return res.status(403).json({ error: "Cannot manage this department" });

  const {
    title,
    description_markdown,
    publish_to_feed,
    publish_to_signage,
    status,
  } = req.body;
  const updated = await prisma.post.update({
    where: { id: Number(req.params.id) },
    data: {
      title,
      description_markdown,
      publish_to_feed: publish_to_feed === "true",
      publish_to_signage: publish_to_signage === "true",
      status,
      updated_at: new Date(),
    },
  });
  res.json(updated);
});

// DELETE post
router.delete("/:id", auth(["admin", "creator"]), async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: Number(req.params.id) },
  });
  if (!post) return res.status(404).json({ error: "Not found" });
  if (!canManage(req.user, post.department_id))
    return res.status(403).json({ error: "Cannot manage this department" });
  await prisma.post.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

module.exports = router;
```

---

**`src/routes/devices.js`** — updated, no more heartbeat via REST (Socket.IO handles it), keep REST for admin reads:

```js
const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");

// List all devices
router.get("/", auth(["admin"]), async (req, res) => {
  const devices = await prisma.device.findMany({
    include: { department: true },
    orderBy: { last_seen: "desc" },
  });
  res.json(devices);
});

// Get single device
router.get("/:id", auth(["admin"]), async (req, res) => {
  const device = await prisma.device.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      department: true,
      sensor_logs: { orderBy: { created_at: "desc" }, take: 50 },
    },
  });
  if (!device) return res.status(404).json({ error: "Not found" });
  res.json(device);
});

// Register device (called once manually or on first boot)
router.post("/register", async (req, res) => {
  const { device_name, ip_address, department_id } = req.body;
  try {
    const device = await prisma.device.upsert({
      where: { ip_address },
      update: { device_name, department_id: department_id || null },
      create: { device_name, ip_address, department_id: department_id || null },
    });
    res.json(device);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
```

---

**`src/routes/sensors.js`** — updated for new `motion/brightness/rain` columns:

```js
const router = require("express").Router();
const prisma = require("../db/prisma");

// Log sensor data (called from Pi via REST as backup, main path is Socket.IO)
router.post("/log", async (req, res) => {
  const { device_id, motion, brightness, rain } = req.body;
  try {
    const log = await prisma.sensorLog.create({
      data: {
        device_id: Number(device_id),
        motion: Boolean(motion),
        brightness: Number(brightness) || 0,
        rain: Boolean(rain),
      },
    });
    res.json(log);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Get logs for a device
router.get("/:device_id", async (req, res) => {
  const logs = await prisma.sensorLog.findMany({
    where: { device_id: Number(req.params.device_id) },
    orderBy: { created_at: "desc" },
    take: 100,
  });
  res.json(logs);
});

module.exports = router;
```

---

**`src/routes/playlists.js`** ← new file:

```js
const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");

router.get("/", auth(["admin", "creator"]), async (req, res) => {
  const where =
    req.user.role === "admin" ? {} : { department_id: req.user.department_id };
  res.json(
    await prisma.playlist.findMany({
      where,
      include: { items: { include: { post: true } } },
    }),
  );
});

router.post("/", auth(["admin", "creator"]), async (req, res) => {
  const { name, department_id } = req.body;
  const dept =
    req.user.role === "admin" ? Number(department_id) : req.user.department_id;
  res.json(
    await prisma.playlist.create({ data: { name, department_id: dept } }),
  );
});

router.put("/:id", auth(["admin", "creator"]), async (req, res) => {
  const { name, items } = req.body; // items: [{post_id, duration_seconds, order_index}]
  const playlist = await prisma.playlist.update({
    where: { id: Number(req.params.id) },
    data: { name },
  });
  if (items) {
    await prisma.playlistItem.deleteMany({
      where: { playlist_id: playlist.id },
    });
    await prisma.playlistItem.createMany({
      data: items.map((i) => ({ ...i, playlist_id: playlist.id })),
    });
  }
  res.json(playlist);
});

router.delete("/:id", auth(["admin"]), async (req, res) => {
  await prisma.playlist.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

module.exports = router;
```

---

## STEP 6 — Socket.IO Server (`src/websocket/socket.js`)

This is the big new piece — replaces polling heartbeat entirely:

```js
// src/websocket/socket.js
const { Server } = require("socket.io");
const prisma = require("../db/prisma");

// Track connected Pi sockets: device_id → socket.id
const deviceSockets = new Map();

module.exports = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // ── Pi → Server: register and heartbeat ──────────────────
    socket.on("heartbeat", async (data) => {
      // data: { device_id, status, timestamp }
      const id = Number(data.device_id);
      deviceSockets.set(id, socket.id);
      socket.deviceId = id;

      await prisma.device
        .update({
          where: { id },
          data: { status: "online", last_seen: new Date() },
        })
        .catch(() => {});

      console.log(`[socket] heartbeat from device ${id}`);
    });

    // ── Pi → Server: sensor data ─────────────────────────────
    socket.on("sensor_update", async (data) => {
      // data: { device_id, motion, brightness, rain }
      await prisma.sensorLog
        .create({
          data: {
            device_id: Number(data.device_id),
            motion: Boolean(data.motion),
            brightness: Number(data.brightness) || 0,
            rain: Boolean(data.rain),
          },
        })
        .catch(() => {});
    });

    // ── Pi → Server: error report ─────────────────────────────
    socket.on("error_log", async (data) => {
      // data: { device_id, error_type, message }
      await prisma.errorLog
        .create({
          data: {
            device_id: Number(data.device_id),
            error_type: data.error_type,
            message: data.message,
          },
        })
        .catch(() => {});
    });

    // ── Pi → Server: playlist confirmed ──────────────────────
    socket.on("playlist_ack", (data) => {
      console.log(
        `[socket] device ${data.device_id} confirmed playlist update`,
      );
    });

    // ── Disconnect: mark offline ──────────────────────────────
    socket.on("disconnect", async () => {
      if (socket.deviceId) {
        deviceSockets.delete(socket.deviceId);
        await prisma.device
          .update({
            where: { id: socket.deviceId },
            data: { status: "offline" },
          })
          .catch(() => {});
        console.log(
          `[socket] device ${socket.deviceId} disconnected → offline`,
        );
      }
    });
  });

  // ── Helpers to push events TO specific Pi ────────────────────
  const emitToDevice = (device_id, event, data) => {
    const socketId = deviceSockets.get(Number(device_id));
    if (socketId) {
      io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  };

  // ── Offline detection: mark devices offline if no heartbeat for 30s ─
  setInterval(async () => {
    const cutoff = new Date(Date.now() - 30_000);
    await prisma.device.updateMany({
      where: { status: "online", last_seen: { lt: cutoff } },
      data: { status: "offline" },
    });
  }, 15_000);

  return { io, emitToDevice };
};
```

---

## STEP 7 — Signage Publish Route (`src/routes/signage.js`)

When a post is published to signage, push a Socket.IO event to the target Pi immediately:

```js
// src/routes/signage.js
const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");

let _emitToDevice; // injected from index.js

router.use((req, _, next) => {
  _emitToDevice = req.app.get("emitToDevice");
  next();
});

// Publish a post to signage → notifies Pi via Socket.IO
router.post("/publish", auth(["admin", "creator"]), async (req, res) => {
  const {
    post_id,
    device_id,
    duration_seconds,
    start_date,
    end_date,
    priority,
    display_group,
  } = req.body;

  const post = await prisma.post.findUnique({
    where: { id: Number(post_id) },
    include: { images: true, signage_metadata: true },
  });
  if (!post) return res.status(404).json({ error: "Post not found" });

  // Upsert signage metadata
  await prisma.signageMetadata.upsert({
    where: { post_id: Number(post_id) },
    update: {
      duration_seconds: Number(duration_seconds) || 10,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      priority: Number(priority) || 1,
      display_group: display_group || null,
    },
    create: {
      post_id: Number(post_id),
      duration_seconds: Number(duration_seconds) || 10,
      start_date: start_date ? new Date(start_date) : null,
      end_date: end_date ? new Date(end_date) : null,
      priority: Number(priority) || 1,
      display_group: display_group || null,
    },
  });

  // Mark post as published signage
  await prisma.post.update({
    where: { id: Number(post_id) },
    data: { publish_to_signage: true, status: "published" },
  });

  // Notify Pi via Socket.IO
  const image = post.images[0];
  const pushed =
    _emitToDevice &&
    _emitToDevice(device_id, "playlist_update", {
      post_id: post.id,
      image_url: image?.image_path,
      duration_seconds: Number(duration_seconds) || 10,
    });

  res.json({ ok: true, pi_notified: !!pushed });
});

// Get signage playlists
router.get("/playlists", auth(["admin"]), async (req, res) => {
  const playlists = await prisma.playlist.findMany({
    include: {
      items: {
        include: { post: { include: { images: true } } },
        orderBy: { order_index: "asc" },
      },
    },
  });
  res.json(playlists);
});

module.exports = router;
```

---

## STEP 8 — Updated `src/index.js`

```js
require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const initSocket = require("./websocket/socket");

const app = express();
const server = http.createServer(app); // ← http server shared with Socket.IO

app.use(cors());
app.use(express.json());
app.use(
  "/uploads",
  (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(path.join(__dirname, "../uploads")),
);

// Init Socket.IO and expose emitToDevice globally on app
const { emitToDevice } = initSocket(server);
app.set("emitToDevice", emitToDevice);

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/departments", require("./routes/departments"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/devices", require("./routes/devices"));
app.use("/api/sensors", require("./routes/sensors"));
app.use("/api/playlists", require("./routes/playlists"));
app.use("/api/signage", require("./routes/signage"));

app.get("/api/health", (_, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## STEP 9 — Create uploads folder structure

```bash
mkdir -p WebServer/backend/uploads/images
```

---

## STEP 10 — Update Pi Scripts for Socket.IO

Replace `heartbeat.py` and `sensor_bridge.py` with a single unified socket client:

```python
# ~/signage/socket_client.py
import socketio, time, threading, serial
from config import SERVER_URL, DEVICE_ID, SERIAL_PORT, BAUD_RATE

sio = socketio.Client()

# ── Server → Pi events ───────────────────────────────────────

@sio.event
def connect():
    print("[socket] Connected to server")

@sio.event
def disconnect():
    print("[socket] Disconnected")

@sio.on('playlist_update')
def on_playlist_update(data):
    print(f"[socket] New playlist: {data}")
    # Hand off to content_sync / anthias_controller
    from anthias_controller import push_to_anthias
    push_to_anthias(data)
    sio.emit('playlist_ack', {'device_id': DEVICE_ID})

@sio.on('refresh_display')
def on_refresh(data):
    import subprocess
    subprocess.run(['pkill', '-HUP', 'anthias'])

@sio.on('restart_display')
def on_restart(data):
    import subprocess
    subprocess.run(['sudo', 'systemctl', 'restart', 'anthias'])

# ── Pi → Server: heartbeat loop ──────────────────────────────

def heartbeat_loop():
    while True:
        try:
            if sio.connected:
                sio.emit('heartbeat', {'device_id': DEVICE_ID, 'status': 'online'})
        except Exception as e:
            print(f"[heartbeat] {e}")
        time.sleep(10)

# ── Pi → Server: sensor loop (reads from Arduino serial) ─────

def sensor_loop():
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)
        time.sleep(2)
        while True:
            line = ser.readline().decode('utf-8').strip()
            if not line.startswith('SENSOR:'):
                continue
            # SENSOR:motion:1,brightness:742,rain:0
            _, payload = line.split(':', 1)
            values = dict(p.split(':') for p in payload.split(','))
            if sio.connected:
                sio.emit('sensor_update', {
                    'device_id':  DEVICE_ID,
                    'motion':     values.get('motion',     '0') == '1',
                    'brightness': int(values.get('brightness', 0)),
                    'rain':       values.get('rain',       '0') == '1',
                })
    except Exception as e:
        print(f"[sensor_loop] {e}")

# ── Main ──────────────────────────────────────────────────────

if __name__ == '__main__':
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    threading.Thread(target=sensor_loop,   daemon=True).start()

    while True:
        try:
            sio.connect(SERVER_URL.replace('/api', ''))
            sio.wait()
        except Exception as e:
            print(f"[socket] Reconnecting in 5s... ({e})")
            time.sleep(5)
```

Install the Python Socket.IO client on Pi:

```bash
pip3 install python-socketio[client] websocket-client
```

Update `config.py` — add `DEVICE_ID`:

```python
DEVICE_ID   = 1   # ← the id returned when you registered the device via /api/devices/register
```

Update Arduino serial format to send all sensors in one line:

```cpp
// Arduino loop()
String msg = "SENSOR:motion:" + String(proximityVal) +
             ",brightness:" + String(lightVal) +
             ",rain:" + String(rainVal);
Serial.println(msg);
delay(2000);
```

---

## Summary of All Changes

| File                         | Action                                                         |
| ---------------------------- | -------------------------------------------------------------- |
| `prisma/schema.prisma`       | Full schema — all 10 tables                                    |
| `.env`                       | DATABASE_URL for Prisma                                        |
| `src/db/prisma.js`           | Replaces pool.js                                               |
| `src/index.js`               | Uses http.createServer + Socket.IO                             |
| `src/websocket/socket.js`    | New — all real-time Pi communication                           |
| `src/routes/auth.js`         | department_id in token                                         |
| `src/routes/posts.js`        | Slug, markdown, multiple images, publish modes, dept isolation |
| `src/routes/devices.js`      | Prisma, register endpoint                                      |
| `src/routes/sensors.js`      | motion/brightness/rain columns                                 |
| `src/routes/departments.js`  | New                                                            |
| `src/routes/playlists.js`    | New                                                            |
| `src/routes/signage.js`      | New — publishes and notifies Pi                                |
| `~/signage/socket_client.py` | Replaces heartbeat.py + sensor_bridge.py                       |

Ready to update the frontend to match these API changes whenever you are.

---

---

---

# Response

I have successfully completed the project setup as specified in `SETUP_GUIDE6.md`.

### Summary of Changes:

#### Backend (Node.js + Prisma + Socket.IO)

- **Database & ORM:**
  - Migrated from raw `pg` queries to **Prisma ORM**.
  - Reset the database and applied a full schema with 10 tables (Departments, Users, Posts, Devices, Playlists, etc.).
  - Configured `.env` with the `signage_admin` database URL.
- **WebSocket Server:**
  - Implemented `src/websocket/socket.js` using **Socket.IO** for real-time communication with Raspberry Pi devices.
  - Replaced REST heartbeats with WebSocket events for improved reliability and speed.
- **Routes & Logic:**
  - Updated all existing routes (`auth`, `posts`, `devices`, `sensors`) to use Prisma.
  - Added new routes for `departments`, `playlists`, and `signage` publishing.
  - Implemented department isolation, slug generation for posts, and real-time signage push notifications.
  - Configured `multer` for multi-image uploads and image serving.

#### Raspberry Pi Scripts (Python + Socket.IO)

- **Socket Client:**
  - Replaced `heartbeat.py` and `sensor_bridge.py` with a unified `socket_client.py`.
  - The client now handles real-time heartbeats, sensor data streaming, and immediate playlist updates from the server.
- **Configuration:**
  - Updated `pi-scripts/config.py` with the required `DEVICE_ID`.

#### Arduino

- **Firmware:**
  - Updated `sensors.ino` to use the new serial message format (`SENSOR:motion:X,brightness:Y,rain:Z`) required for the updated Pi scripts.

### Addressing your question about `.env`:

The `.env` file I initially created used the default `postgres` user, while `SETUP_GUIDE6.md` recommended `signage_admin`. I have now updated the `.env` file to match the guide's recommendation:

```env
DATABASE_URL="postgresql://signage_admin:yourpassword@localhost:5432/signage_db"
```

_Note: Please ensure the `signage_admin` user exists in your PostgreSQL instance with the correct password, or adjust the URL if you prefer to use a different user._

The project is now ready for the frontend updates!
