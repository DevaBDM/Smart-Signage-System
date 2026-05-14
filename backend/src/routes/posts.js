const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const { upsertSignageAsset } = require("../utils/signageAssets");

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
    if (!allowed.includes(path.extname(file.originalname).toLowerCase())) {
      return cb(new Error("Only PNG, JPG, JPEG, and WEBP images are allowed"));
    }
    cb(null, true);
  },
});

const uploadImages = (req, res, next) => {
  upload.array("images", 10)(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Each image must be 10MB or smaller"
        : err.message || "Image upload failed";
    return res.status(400).json({ error: message });
  });
};

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") +
  "-" +
  Date.now();

const canManage = (user, department_id) =>
  user.role === "admin" || user.department_id === Number(department_id);

const parseDeviceIds = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(Number).filter(Boolean);
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) return parsed.map(Number).filter(Boolean);
  } catch {}
  return String(value).split(",").map(Number).filter(Boolean);
};

const toBool = (val) => val === true || val === "true";

// Helper: Ensure all target devices are online
const ensureDevicesOnline = async (deviceIds) => {
  if (!deviceIds || deviceIds.length === 0) return { ok: true };
  const offline = await prisma.device.findMany({
    where: { id: { in: deviceIds }, status: { not: "online" } }
  });
  if (offline.length > 0) {
    return { 
      ok: false, 
      error: `Operation cancelled. The following displays are offline: ${offline.map(d => d.device_name).join(", ")}` 
    };
  }
  return { ok: true };
};

const deployToSignage = async (req, post, targetDevices, signageData) => {
  const emitToDeviceAck = req.app.get("emitToDeviceAck");
  const image = post.images?.[0];
  if (!image || post.status !== "published") return [];

  const results = [];
  for (const device of targetDevices) {
    try {
      await prisma.signageDeployment.upsert({
        where: { device_id_post_id: { device_id: device.id, post_id: post.id } },
        update: {
          duration_seconds: Number(signageData.duration_seconds) || 10,
          start_date: signageData.start_date ? new Date(signageData.start_date) : null,
          end_date: signageData.end_date ? new Date(signageData.end_date) : null,
          priority: Number(signageData.priority) || 1,
          display_group: signageData.display_group || null,
          status: "pending",
          last_error: null,
        },
        create: {
          device_id: device.id,
          post_id: post.id,
          duration_seconds: Number(signageData.duration_seconds) || 10,
          start_date: signageData.start_date ? new Date(signageData.start_date) : null,
          end_date: signageData.end_date ? new Date(signageData.end_date) : null,
          priority: Number(signageData.priority) || 1,
          display_group: signageData.display_group || null,
          status: "pending",
        },
      });

      const existingAsset = await prisma.signageAsset.findFirst({
        where: { device_id: device.id, post_id: post.id },
      });

      const result = existingAsset
        ? { ok: true, already_exists: true, asset: existingAsset }
        : emitToDeviceAck
        ? await emitToDeviceAck(
            device.id,
            "signage_command",
            {
              action: "publish_asset",
              post_id: post.id,
              title: post.title,
              image_url: image.image_path,
              duration_seconds: Number(signageData.duration_seconds) || 10,
              start_date: signageData.start_date || null,
              end_date: signageData.end_date || null,
            },
            12000,
          )
        : { ok: false, error: "Socket bridge is not ready" };

      if (result.ok) {
        await upsertSignageAsset(prisma, {
          device_id: device.id,
          post_id: post.id,
          image_url: image.image_path,
          asset: result.asset,
        });
        await prisma.signageDeployment.update({
          where: { device_id_post_id: { device_id: device.id, post_id: post.id } },
          data: { status: "synced", last_error: null },
        });
      } else {
        await prisma.signageDeployment.update({
          where: { device_id_post_id: { device_id: device.id, post_id: post.id } },
          data: { status: "pending", last_error: result.error || null },
        });
      }
      results.push({ device_id: device.id, device_name: device.device_name, result });
    } catch (e) {
      console.error(`Signage deploy failed for device ${device.id}:`, e);
    }
  }
  return results;
};

// GET all posts
router.get("/", async (req, res) => {
  const { feed, department_id, status } = req.query;
  const where = {};
  if (toBool(feed)) {
    where.publish_to_feed = true;
    where.status = "published";
  } else if (status) {
    where.status = status;
  }
  if (department_id && !isNaN(Number(department_id))) {
    where.department_id = Number(department_id);
  }
  const posts = await prisma.post.findMany({
    where,
    include: {
      images: { orderBy: { order_index: "asc" } },
      signage_metadata: true,
      signage_deployments: true,
    },
    orderBy: { created_at: "desc" },
  });
  res.json(posts);
});

// GET single post
router.get("/:id", async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: Number(req.params.id) },
    include: { images: true, signage_metadata: true, signage_deployments: true },
  });
  if (!post) return res.status(404).json({ error: "Not found" });
  res.json(post);
});

// POST create post
router.post("/", auth(["admin", "creator"]), uploadImages, async (req, res) => {
  const { title, description_markdown, department_id, publish_to_feed, publish_to_signage, status, device_ids } = req.body;
  const targetDepartmentId = req.user.role === "admin" ? Number(department_id) : req.user.department_id;
  if (!targetDepartmentId || !canManage(req.user, targetDepartmentId)) return res.status(403).json({ error: "Invalid department access" });

  // Status Check: Offline devices block creation if signage requested
  const selectedDeviceIds = parseDeviceIds(device_ids);
  if (toBool(publish_to_signage)) {
    const onlineCheck = await ensureDevicesOnline(selectedDeviceIds);
    if (!onlineCheck.ok) return res.status(400).json({ error: onlineCheck.error });
  }

  try {
    const post = await prisma.post.create({
      data: {
        title,
        slug: slugify(title),
        description_markdown: description_markdown || null,
        department_id: Number(targetDepartmentId),
        created_by: req.user.id,
        publish_to_feed: toBool(publish_to_feed),
        publish_to_signage: toBool(publish_to_signage),
        status: status || "draft",
        images: {
          create: (req.files || []).map((f, i) => ({
            image_path: `/uploads/images/${f.filename}`,
            order_index: i,
          })),
        },
        ...(toBool(publish_to_signage) && {
          signage_metadata: {
            create: {
              duration_seconds: Number(req.body.duration_seconds) || 10,
              start_date: req.body.start_date ? new Date(req.body.start_date) : null,
              end_date: req.body.end_date ? new Date(req.body.end_date) : null,
              priority: Number(req.body.priority) || 1,
              display_group: req.body.display_group || null,
            },
          },
        }),
      },
      include: { images: true, signage_metadata: true },
    });

    let signage_deployments = [];
    if (toBool(publish_to_signage) && post.status === "published") {
      const targetDevices = await prisma.device.findMany({ where: { id: { in: selectedDeviceIds } } });
      signage_deployments = await deployToSignage(req, post, targetDevices, req.body);
    }
    res.json({ ...post, signage_deployments });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT update post
router.put("/:id", auth(["admin", "creator"]), uploadImages, async (req, res) => {
  const postId = Number(req.params.id);
  const post = await prisma.post.findUnique({ where: { id: postId }, include: { images: true } });
  if (!post) return res.status(404).json({ error: "Not found" });
  if (!canManage(req.user, post.department_id)) return res.status(403).json({ error: "Forbidden" });

  const { title, description_markdown, publish_to_feed, publish_to_signage, status, device_ids } = req.body;
  const selectedIds = parseDeviceIds(device_ids);

  // Status Check: Offline devices block signage updates
  if (toBool(publish_to_signage)) {
    const onlineCheck = await ensureDevicesOnline(selectedIds);
    if (!onlineCheck.ok) return res.status(400).json({ error: onlineCheck.error });
  }

  try {
    if (req.files && req.files.length > 0) {
      for (const img of post.images) {
        const fullPath = path.join(__dirname, "../..", img.image_path);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
      await prisma.postImage.deleteMany({ where: { post_id: postId } });
      await prisma.postImage.createMany({
        data: req.files.map((f, i) => ({
          post_id: postId,
          image_path: `/uploads/images/${f.filename}`,
          order_index: i,
        })),
      });
    }

    if (toBool(publish_to_signage)) {
      await prisma.signageMetadata.upsert({
        where: { post_id: postId },
        update: {
          duration_seconds: Number(req.body.duration_seconds) || 10,
          start_date: req.body.start_date ? new Date(req.body.start_date) : null,
          end_date: req.body.end_date ? new Date(req.body.end_date) : null,
          priority: Number(req.body.priority) || 1,
          display_group: req.body.display_group || null,
        },
        create: {
          post_id: postId,
          duration_seconds: Number(req.body.duration_seconds) || 10,
          start_date: req.body.start_date ? new Date(req.body.start_date) : null,
          end_date: req.body.end_date ? new Date(req.body.end_date) : null,
          priority: Number(req.body.priority) || 1,
          display_group: req.body.display_group || null,
        },
      });
    }

    const updated = await prisma.post.update({
      where: { id: postId },
      data: {
        title,
        description_markdown,
        publish_to_feed: toBool(publish_to_feed),
        publish_to_signage: toBool(publish_to_signage),
        status,
        updated_at: new Date(),
      },
      include: { images: true, signage_metadata: true },
    });

    let signage_deployments = [];
    if (updated.status === "published") {
      const emitToDeviceAck = req.app.get("emitToDeviceAck");
      
      if (toBool(publish_to_signage)) {
        const deploymentsToRemove = await prisma.signageDeployment.findMany({
          where: { post_id: postId, device_id: { notIn: selectedIds } }
        });
        for (const dep of deploymentsToRemove) {
          if (emitToDeviceAck) await emitToDeviceAck(dep.device_id, "signage_command", { action: "delete_post_assets", post_id: postId }, 5000).catch(() => {});
          await prisma.signageDeployment.delete({ where: { id: dep.id } });
          await prisma.signageAsset.deleteMany({ where: { post_id: postId, device_id: dep.device_id } });
        }
        if (selectedIds.length > 0) {
          const targetDevices = await prisma.device.findMany({ where: { id: { in: selectedIds } } });
          signage_deployments = await deployToSignage(req, updated, targetDevices, req.body);
        }
      } else {
        const allDeps = await prisma.signageDeployment.findMany({ where: { post_id: postId } });
        for (const dep of allDeps) {
          if (emitToDeviceAck) await emitToDeviceAck(dep.device_id, "signage_command", { action: "delete_post_assets", post_id: postId }, 5000).catch(() => {});
        }
        await prisma.signageDeployment.deleteMany({ where: { post_id: postId } });
        await prisma.signageAsset.deleteMany({ where: { post_id: postId } });
      }
    }
    res.json({ ...updated, signage_deployments });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE post
router.delete("/:id", auth(["admin", "creator"]), async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: Number(req.params.id) }, include: { images: true } });
  if (!post || !canManage(req.user, post.department_id)) return res.status(403).json({ error: "Forbidden" });

  const emitToDeviceAck = req.app.get("emitToDeviceAck");
  const devices = await prisma.device.findMany({ where: { department_id: post.department_id } });

  // Status check: if we want to delete from signage, ALL targeted devices must be online
  const signageDeps = await prisma.signageDeployment.findMany({ where: { post_id: post.id } });
  const depDeviceIds = signageDeps.map(d => d.device_id);
  const onlineCheck = await ensureDevicesOnline(depDeviceIds);
  if (!onlineCheck.ok) return res.status(400).json({ error: onlineCheck.error });

  if (emitToDeviceAck) {
    for (const device of devices) {
      await emitToDeviceAck(device.id, "signage_command", { action: "delete_post_assets", post_id: post.id }, 12000).catch(() => {});
    }
  }

  for (const img of post.images) {
    const fullPath = path.join(__dirname, "../..", img.image_path);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }

  await prisma.post.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

// BULK ACTIONS
router.post("/bulk-action", auth(["admin", "creator"]), async (req, res) => {
  const { ids, action, device_ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "No IDs provided" });

  const selectedDeviceIds = parseDeviceIds(device_ids);
  
  // Status check for bulk signage operations
  if (["add-signage", "add-both", "remove-signage", "delete"].includes(action)) {
    // For delete, we check ALL devices currently showing ANY of the selected posts
    let checkIds = selectedDeviceIds;
    if (action === "delete" || (action === "remove-signage" && selectedDeviceIds.length === 0)) {
      const deps = await prisma.signageDeployment.findMany({ where: { post_id: { in: ids.map(Number) } } });
      checkIds = [...new Set(deps.map(d => d.device_id))];
    }
    const onlineCheck = await ensureDevicesOnline(checkIds);
    if (!onlineCheck.ok) return res.status(400).json({ error: onlineCheck.error });
  }

  const posts = await prisma.post.findMany({
    where: {
      id: { in: ids.map(Number) },
      ...(req.user.role !== "admin" && { department_id: req.user.department_id })
    },
    include: { images: true, signage_metadata: true, signage_deployments: true }
  });

  const validIds = posts.map(p => p.id);
  const emitToDeviceAck = req.app.get("emitToDeviceAck");

  try {
    if (action === "delete") {
      const deps = await prisma.signageDeployment.findMany({ where: { post_id: { in: validIds } } });
      if (emitToDeviceAck) {
        for (const dep of deps) {
          await emitToDeviceAck(dep.device_id, "signage_command", { action: "delete_post_assets", post_id: dep.post_id }, 2000).catch(() => {});
        }
      }
      for (const p of posts) {
        for (const img of p.images) {
          const fullPath = path.join(__dirname, "../..", img.image_path);
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }
      }
      await prisma.post.deleteMany({ where: { id: { in: validIds } } });
    } 
    else if (action === "remove-signage") {
      const targetIds = selectedDeviceIds.length > 0 ? selectedDeviceIds : null;
      const deps = await prisma.signageDeployment.findMany({ 
        where: { post_id: { in: validIds }, ...(targetIds && { device_id: { in: targetIds } }) } 
      });
      if (emitToDeviceAck) {
        for (const dep of deps) {
          await emitToDeviceAck(dep.device_id, "signage_command", { action: "delete_post_assets", post_id: dep.post_id }, 2000).catch(() => {});
        }
      }
      await prisma.signageDeployment.deleteMany({ 
        where: { post_id: { in: validIds }, ...(targetIds && { device_id: { in: targetIds } }) } 
      });
      await prisma.signageAsset.deleteMany({ 
        where: { post_id: { in: validIds }, ...(targetIds && { device_id: { in: targetIds } }) } 
      });
      if (!targetIds) {
        await prisma.post.updateMany({ where: { id: { in: validIds } }, data: { publish_to_signage: false } });
      } else {
        for (const pid of validIds) {
          const count = await prisma.signageDeployment.count({ where: { post_id: pid } });
          if (count === 0) await prisma.post.update({ where: { id: pid }, data: { publish_to_signage: false } });
        }
      }
    }
    else if (action === "remove-feed") {
      await prisma.post.updateMany({ where: { id: { in: validIds } }, data: { publish_to_feed: false } });
    }
    else if (action === "add-feed") {
      await prisma.post.updateMany({ where: { id: { in: validIds } }, data: { publish_to_feed: true, status: "published" } });
    }
    else if (action === "add-signage" || action === "add-both") {
      const publishFeed = action === "add-both";
      for (const p of posts) {
        const updated = await prisma.post.update({
          where: { id: p.id },
          data: { publish_to_signage: true, status: "published", ...(publishFeed && { publish_to_feed: true }) },
          include: { images: true, signage_metadata: true }
        });
        const targetIds = selectedDeviceIds.length > 0 ? selectedDeviceIds : p.signage_deployments.map(d => d.device_id);
        if (targetIds.length > 0) {
          const targetDevices = await prisma.device.findMany({ where: { id: { in: targetIds } } });
          await deployToSignage(req, updated, targetDevices, {
            duration_seconds: updated.signage_metadata?.duration_seconds,
            start_date: updated.signage_metadata?.start_date,
            end_date: updated.signage_metadata?.end_date,
            priority: updated.signage_metadata?.priority,
            display_group: updated.signage_metadata?.display_group
          });
        }
      }
    }
    res.json({ ok: true, count: validIds.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
