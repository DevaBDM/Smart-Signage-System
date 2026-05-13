const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
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

const parseDeviceIds = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(Number).filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(Number).filter(Boolean);
  } catch {}
  return String(value)
    .split(",")
    .map(Number)
    .filter(Boolean);
};

// GET all posts (public-safe, feed only returns published feed posts)
router.get("/", async (req, res) => {
  const { feed, department_id } = req.query;
  const where = {};
  if (feed === "true") where.publish_to_feed = true;
  if (feed === "true") where.status = "published";
  
  if (department_id && !isNaN(Number(department_id))) {
    where.department_id = Number(department_id);
  }
  
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
  uploadImages,
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
      device_ids,
    } = req.body;

    const targetDepartmentId =
      req.user.role === "admin" ? Number(department_id) : req.user.department_id;

    if (!targetDepartmentId) {
      return res.status(400).json({
        error: "Your account is not assigned to a department. Ask an admin to assign one.",
      });
    }

    if (!canManage(req.user, targetDepartmentId))
      return res.status(403).json({ error: "Cannot manage this department" });

    const selectedDeviceIds = parseDeviceIds(device_ids);
    if (publish_to_signage === "true" && selectedDeviceIds.length === 0) {
      return res.status(400).json({
        error: "Select at least one display for signage publishing.",
      });
    }

    const targetDevices =
      selectedDeviceIds.length > 0
        ? await prisma.device.findMany({
            where: { id: { in: selectedDeviceIds } },
          })
        : [];

    if (
      targetDevices.some(
        (device) =>
          req.user.role !== "admin" &&
          device.department_id !== req.user.department_id,
      )
    ) {
      return res.status(403).json({ error: "Cannot publish to one or more displays" });
    }

    try {
      const post = await prisma.post.create({
        data: {
          title,
          slug: slugify(title),
          description_markdown: description_markdown || null,
          department_id: Number(targetDepartmentId),
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

      const emitToDeviceAck = req.app.get("emitToDeviceAck");
      const image = post.images[0];
      const deploymentResults = [];

      if (publish_to_signage === "true" && image) {
        for (const device of targetDevices) {
          await prisma.signageDeployment.upsert({
            where: {
              device_id_post_id: {
                device_id: device.id,
                post_id: post.id,
              },
            },
            update: {
              duration_seconds: Number(duration_seconds) || 10,
              start_date: start_date ? new Date(start_date) : null,
              end_date: end_date ? new Date(end_date) : null,
              priority: Number(priority) || 1,
              display_group: display_group || null,
              status: "pending",
              last_error: null,
            },
            create: {
              device_id: device.id,
              post_id: post.id,
              duration_seconds: Number(duration_seconds) || 10,
              start_date: start_date ? new Date(start_date) : null,
              end_date: end_date ? new Date(end_date) : null,
              priority: Number(priority) || 1,
              display_group: display_group || null,
              status: "pending",
            },
          });

          const existingAsset = await prisma.signageAsset.findFirst({
            where: {
              device_id: device.id,
              post_id: post.id,
            },
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
                  duration_seconds: Number(duration_seconds) || 10,
                  start_date: start_date || null,
                  end_date: end_date || null,
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
              where: {
                device_id_post_id: {
                  device_id: device.id,
                  post_id: post.id,
                },
              },
              data: { status: "synced", last_error: null },
            });
          } else {
            await prisma.signageDeployment.update({
              where: {
                device_id_post_id: {
                  device_id: device.id,
                  post_id: post.id,
                },
              },
              data: { status: "pending", last_error: result.error || null },
            });
          }

          deploymentResults.push({
            device_id: device.id,
            device_name: device.device_name,
            result,
          });
        }
      }

      res.json({ ...post, signage_deployments: deploymentResults });
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
    include: { images: { orderBy: { order_index: "asc" } } },
  });
  if (!post) return res.status(404).json({ error: "Not found" });
  if (!canManage(req.user, post.department_id))
    return res.status(403).json({ error: "Cannot manage this department" });

  const removeFromSignage = req.query.delete_signage === "true";
  let signage_results = [];
  if (removeFromSignage) {
    const emitToDeviceAck = req.app.get("emitToDeviceAck");
    const devices = await prisma.device.findMany({
      where:
        req.user.role === "admin"
          ? { department_id: post.department_id }
          : { department_id: req.user.department_id },
    });

    if (emitToDeviceAck) {
      signage_results = await Promise.all(
        devices.map(async (device) => ({
          device_id: device.id,
          device_name: device.device_name,
          result: await emitToDeviceAck(
            device.id,
            "signage_command",
            {
              action: "delete_post_assets",
              post_id: post.id,
              image_url: post.images?.[0]?.image_path,
            },
            12000,
          ),
        })),
      );

      const cleanedDeviceIds = signage_results
        .filter((item) => item.result?.ok)
        .map((item) => item.device_id);
      if (cleanedDeviceIds.length > 0) {
        await prisma.signageAsset.deleteMany({
          where: {
            post_id: post.id,
            device_id: { in: cleanedDeviceIds },
          },
        });
      }
    }
  }

  await prisma.post.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true, signage_results });
});

module.exports = router;
