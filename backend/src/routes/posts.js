const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const { upsertSignageAsset } = require("../utils/signageAssets");
const { ensureDevicesOnline, getOnlineDeviceIdSet } = require("../utils/devices");

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

const canManagePost = (user, post) =>
  user.role === "admin" || post.created_by === user.id;

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

/** Normalize schedule fields from req.body or Prisma signage_metadata. */
const deploymentSchedule = (raw) => ({
  duration_seconds: Number(raw?.duration_seconds) || 10,
  start_date: raw?.start_date ? new Date(raw.start_date) : null,
  end_date: raw?.end_date ? new Date(raw.end_date) : null,
  priority: Number(raw?.priority) || 1,
  display_group: raw?.display_group ?? null,
});

/** Upsert SignageDeployment rows; push to Pi only when published + allowed + online. */
const deployToSignage = async (req, post, targetDevices, signageData) => {
  const emitToDeviceAck = req.app.get("emitToDeviceAck");
  const image = post.images?.[0];
  if (!image) return [];

  const sched = deploymentSchedule(signageData);
  const results = [];
  for (const device of targetDevices) {
    try {
      await prisma.signageDeployment.upsert({
        where: { device_id_post_id: { device_id: device.id, post_id: post.id } },
        update: { ...sched, status: "pending", last_error: null },
        create: { device_id: device.id, post_id: post.id, ...sched, status: "pending" },
      });

      // 2. Push to Pi only when published + allowed + display online (offline: DB row stays pending for pull/sync later)
      if (post.status === "published" && post.allowed_on_signage) {
        if (device.status !== "online") {
          await prisma.signageDeployment.update({
            where: { device_id_post_id: { device_id: device.id, post_id: post.id } },
            data: {
              status: "pending",
              last_error:
                "Display offline — deployment saved; will sync when the display is online.",
            },
          });
          results.push({
            device_id: device.id,
            device_name: device.device_name,
            result: { ok: true, offline_queued: true },
          });
          continue;
        }

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
                  duration_seconds: sched.duration_seconds,
                  start_date: sched.start_date || null,
                  end_date: sched.end_date || null,
                },
                12000,
              )
            : { ok: false, error: "Socket bridge is not ready" };

        if (result.ok) {
          if (result.asset) {
            await upsertSignageAsset(prisma, {
              device_id: device.id,
              post_id: post.id,
              image_url: image.image_path,
              asset: result.asset,
            });
          }
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
      } else {
        results.push({ device_id: device.id, device_name: device.device_name, result: { ok: true, note: "Deployment saved but not live." } });
      }
    } catch (e) {
      console.error(`Signage deploy failed for device ${device.id}:`, e);
    }
  }
  return results;
};

// GET all posts
router.get("/", async (req, res) => {
  const { feed, department_id, status, channel, device_id, creator_id } = req.query;
  const where = {};
  if (toBool(feed)) {
    where.allowed_on_feed = true;
    where.status = "published";
  } else if (status) {
    where.status = status;
  }
  if (channel === "feed") {
    where.allowed_on_feed = true;
    where.allowed_on_signage = false;
  } else if (channel === "signage") {
    where.allowed_on_signage = true;
    where.allowed_on_feed = false;
  }
  if (department_id && !isNaN(Number(department_id))) {
    where.department_id = Number(department_id);
  }
  if (creator_id && !isNaN(Number(creator_id))) {
    where.created_by = Number(creator_id);
  }
  if (device_id && !isNaN(Number(device_id))) {
    where.signage_deployments = {
      some: { device_id: Number(device_id) },
    };
  }
  const posts = await prisma.post.findMany({
    where,
    include: {
      author: { select: { id: true, username: true, auto_approve: true } },
      images: { orderBy: { order_index: "asc" } },
      signage_metadata: true,
      signage_deployments: true,
      department: true,
    },
    orderBy: { created_at: "desc" },
  });
  res.json(posts);
});

// GET single post
router.get("/:id", async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: Number(req.params.id) },
    include: { author: true, images: true, signage_metadata: true, signage_deployments: true },
  });
  if (!post) return res.status(404).json({ error: "Not found" });
  res.json(post);
});

// POST create post
router.post("/", auth(["admin", "creator"]), uploadImages, async (req, res) => {
  const {
    title,
    description_markdown,
    department_id,
    allowed_on_feed,
    allowed_on_signage,
    publish_to_feed,
    publish_to_signage,
    status,
    device_ids,
  } = req.body;
  const targetDepartmentId =
    req.user.role === "admin" ? Number(department_id) : req.user.department_id;
  if (!targetDepartmentId || !canManage(req.user, targetDepartmentId)) return res.status(403).json({ error: "Invalid department access" });

  const selectedDeviceIds = parseDeviceIds(device_ids);
  
  const creator = await prisma.user.findUnique({ where: { id: req.user.id } });
  const isAutoApprove = creator?.auto_approve || req.user.role === 'admin';

  // Intent (handle both naming conventions)
  const requestedFeed = toBool(allowed_on_feed !== undefined ? allowed_on_feed : publish_to_feed);
  const requestedSignage = toBool(allowed_on_signage !== undefined ? allowed_on_signage : publish_to_signage);

  if (selectedDeviceIds.length > 0) {
    const chk = await ensureDevicesOnline(prisma, selectedDeviceIds);
    if (!chk.ok) return res.status(400).json({ error: chk.error });
  }

  try {
    const post = await prisma.post.create({
      data: {
        title,
        slug: slugify(title),
        description_markdown: description_markdown || null,
        department_id: Number(targetDepartmentId),
        created_by: req.user.id,
        // Permissions
        allowed_on_feed: isAutoApprove ? requestedFeed : false,
        allowed_on_signage: isAutoApprove ? requestedSignage : false,
        // Intent
        requested_feed: requestedFeed,
        requested_signage: requestedSignage,
        status: status || "draft",
        images: {
          create: (req.files || []).map((f, i) => ({
            image_path: `/uploads/images/${f.filename}`,
            order_index: i,
          })),
        },
        signage_metadata: {
          create: {
            duration_seconds: Number(req.body.duration_seconds) || 10,
            start_date: req.body.start_date ? new Date(req.body.start_date) : null,
            end_date: req.body.end_date ? new Date(req.body.end_date) : null,
            priority: Number(req.body.priority) || 1,
            display_group: req.body.display_group || null,
          },
        },
      },
      include: { images: true, signage_metadata: true },
    });

    // Always create deployment records
    const targetDevices = await prisma.device.findMany({ where: { id: { in: selectedDeviceIds } } });
    const signage_deployments = await deployToSignage(
      req,
      post,
      targetDevices,
      req.body,
    );

    res.json({ ...post, signage_deployments });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT update post
router.put("/:id", auth(["admin", "creator"]), uploadImages, async (req, res) => {
  const postId = Number(req.params.id);
  const post = await prisma.post.findUnique({ where: { id: postId }, include: { images: true, author: true } });
  if (!post) return res.status(404).json({ error: "Not found" });
  if (!canManage(req.user, post.department_id)) return res.status(403).json({ error: "Forbidden" });
  if (!canManagePost(req.user, post)) return res.status(403).json({ error: "Creators can only edit their own posts." });

  const { title, description_markdown, publish_to_feed, publish_to_signage, allowed_on_feed, allowed_on_signage, status, device_ids } = req.body;
  const selectedIds = parseDeviceIds(device_ids);
  const isAutoApprove = post.author?.auto_approve || req.user.role === 'admin';

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

    const data = {
      title,
      description_markdown,
      status,
    };

    // If Admin is editing, update PERMISSION directly
    if (req.user.role === 'admin') {
      if (allowed_on_feed !== undefined) {
        data.allowed_on_feed = toBool(allowed_on_feed);
        if (!data.allowed_on_feed) data.requested_feed = false;
      } else if (publish_to_feed !== undefined) {
        data.allowed_on_feed = toBool(publish_to_feed);
        if (!data.allowed_on_feed) data.requested_feed = false;
      }

      if (allowed_on_signage !== undefined) {
        data.allowed_on_signage = toBool(allowed_on_signage);
        if (!data.allowed_on_signage) data.requested_signage = false;
      } else if (publish_to_signage !== undefined) {
        data.allowed_on_signage = toBool(publish_to_signage);
        if (!data.allowed_on_signage) data.requested_signage = false;
      }
    } 
    // If Creator is editing, update INTENT
    else {
      const feedVal = allowed_on_feed !== undefined ? allowed_on_feed : publish_to_feed;
      if (feedVal !== undefined) {
        data.requested_feed = toBool(feedVal);
        if (isAutoApprove) data.allowed_on_feed = toBool(feedVal);
      }
      const signageVal = allowed_on_signage !== undefined ? allowed_on_signage : publish_to_signage;
      if (signageVal !== undefined) {
        data.requested_signage = toBool(signageVal);
        if (isAutoApprove) data.allowed_on_signage = toBool(signageVal);
      }
    }

    if (selectedIds.length > 0) {
      const chk = await ensureDevicesOnline(prisma, selectedIds);
      if (!chk.ok) return res.status(400).json({ error: chk.error });
    }

    const updated = await prisma.post.update({
      where: { id: postId },
      data,
      include: { images: true, signage_metadata: true },
    });

    const emitToDeviceAck = req.app.get("emitToDeviceAck");

    const allDeps = await prisma.signageDeployment.findMany({ where: { post_id: postId } });

    if (!updated.allowed_on_signage) {
      await prisma.signageAsset.deleteMany({ where: { post_id: postId } });

      if (updated.status === "published" && emitToDeviceAck) {
        const purgeOnline = await getOnlineDeviceIdSet(
          prisma,
          allDeps.map((d) => d.device_id),
        );
        for (const dep of allDeps) {
          if (!purgeOnline.has(dep.device_id)) continue;
          await emitToDeviceAck(
            dep.device_id,
            "signage_command",
            { action: "delete_post_assets", post_id: postId },
            5000,
          ).catch(() => {});
        }
      }
    }

    // Creators: reconcile targets from form. If "signage ready" is off, always clear every target display / deployment.
    // Admins: only when signage is allowed; use explicit device_ids if sent, else keep existing deployments.
    let syncIds = null;
    if (req.user.role !== "admin") {
      syncIds = !updated.requested_signage ? [] : selectedIds;
    } else if (updated.allowed_on_signage) {
      syncIds =
        selectedIds.length > 0
          ? selectedIds
          : allDeps.map((d) => d.device_id);
      if (syncIds.length === 0) syncIds = null;
    }

    const removeDeployments = async (removedIds) => {
      if (!removedIds.length) return;
      const removedOnline = await getOnlineDeviceIdSet(prisma, removedIds);
      for (const did of removedIds) {
        await prisma.signageAsset.deleteMany({ where: { post_id: postId, device_id: did } });
        if (emitToDeviceAck && removedOnline.has(did)) {
          await emitToDeviceAck(
            did,
            "signage_command",
            { action: "delete_post_assets", post_id: postId },
            5000,
          ).catch(() => {});
        }
        await prisma.signageDeployment.delete({
          where: { device_id_post_id: { device_id: did, post_id: postId } },
        });
      }
    };

    if (syncIds !== null) {
      if (syncIds.length > 0) {
        const targetDevices = await prisma.device.findMany({ where: { id: { in: syncIds } } });
        await deployToSignage(req, updated, targetDevices, req.body);
        const removedIds = allDeps.map((d) => d.device_id).filter((id) => !syncIds.includes(id));
        await removeDeployments(removedIds);
      } else if (req.user.role !== "admin" && allDeps.length > 0) {
        await removeDeployments(allDeps.map((d) => d.device_id));
      } else if (req.user.role === "admin" && updated.allowed_on_signage && allDeps.length > 0) {
        const targetDevices = await prisma.device.findMany({
          where: { id: { in: allDeps.map((d) => d.device_id) } },
        });
        await deployToSignage(
          req,
          updated,
          targetDevices,
          updated.signage_metadata || {},
        );
      }
    }

    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE post
router.delete("/:id", auth(["admin", "creator"]), async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: Number(req.params.id) }, include: { images: true } });
  if (!post || !canManage(req.user, post.department_id)) return res.status(403).json({ error: "Forbidden" });
  if (!canManagePost(req.user, post)) return res.status(403).json({ error: "Creators can only delete their own posts." });

  const emitToDeviceAck = req.app.get("emitToDeviceAck");
  const signageDeps = await prisma.signageDeployment.findMany({ where: { post_id: post.id } });
  const depDeviceIds = signageDeps.map(d => d.device_id);

  await prisma.playlistItem.deleteMany({ where: { post_id: post.id } });

  const deleteOnline = await getOnlineDeviceIdSet(prisma, depDeviceIds);
  if (emitToDeviceAck) {
    for (const did of depDeviceIds) {
      if (!deleteOnline.has(did)) continue;
      await emitToDeviceAck(did, "signage_command", { action: "delete_post_assets", post_id: post.id }, 12000).catch(() => {});
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
  
  const posts = await prisma.post.findMany({
    where: {
      id: { in: ids.map(Number) },
      ...(req.user.role !== "admin" && {
        department_id: req.user.department_id,
        created_by: req.user.id,
      }),
    },
    include: { images: true, signage_metadata: true, signage_deployments: true, author: true }
  });

  const validIds = posts.map(p => p.id);
  const emitToDeviceAck = req.app.get("emitToDeviceAck");

  try {
    if (action === "delete") {
      await prisma.playlistItem.deleteMany({ where: { post_id: { in: validIds } } });
      for (const p of posts) {
        if (emitToDeviceAck) {
          const bulkDelOnline = await getOnlineDeviceIdSet(
            prisma,
            p.signage_deployments.map((d) => d.device_id),
          );
          for (const d of p.signage_deployments) {
            if (!bulkDelOnline.has(d.device_id)) continue;
            await emitToDeviceAck(d.device_id, "signage_command", { action: "delete_post_assets", post_id: p.id }, 2000).catch(() => {});
          }
        }
        for (const img of p.images) {
          const fullPath = path.join(__dirname, "../..", img.image_path);
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }
      }
      await prisma.post.deleteMany({ where: { id: { in: validIds } } });
    } 
    else if (action === "remove-signage") {
      if (emitToDeviceAck) {
        const deps = await prisma.signageDeployment.findMany({ where: { post_id: { in: validIds } } });
        const rsOnline = await getOnlineDeviceIdSet(
          prisma,
          deps.map((d) => d.device_id),
        );
        for (const dep of deps) {
          if (!rsOnline.has(dep.device_id)) continue;
          await emitToDeviceAck(dep.device_id, "signage_command", { action: "delete_post_assets", post_id: dep.post_id }, 2000).catch(() => {});
        }
      }
      await prisma.signageAsset.deleteMany({ where: { post_id: { in: validIds } } });
      await prisma.post.updateMany({
        where: { id: { in: validIds } },
        data: { allowed_on_signage: false, requested_signage: false },
      });
    }
    else if (action === "remove-feed") {
      await prisma.post.updateMany({
        where: { id: { in: validIds } },
        data: { allowed_on_feed: false, requested_feed: false },
      });
    }
    else if (action === "add-feed") {
      for (const p of posts) {
         const isAutoApprove = p.author?.auto_approve || req.user.role === 'admin';
         await prisma.post.update({
           where: { id: p.id },
           data: { 
             requested_feed: true, 
             allowed_on_feed: isAutoApprove, 
           }
         });
      }
    }
    else if (action === "add-signage" || action === "add-both") {
      const publishFeed = action === "add-both";
      const unionTargets = new Set();
      for (const p of posts) {
        const t =
          selectedDeviceIds.length > 0
            ? selectedDeviceIds
            : p.signage_deployments.map((d) => d.device_id);
        t.forEach((id) => unionTargets.add(id));
      }
      const unionArr = [...unionTargets];
      if (unionArr.length > 0) {
        const chk = await ensureDevicesOnline(prisma, unionArr);
        if (!chk.ok) return res.status(400).json({ error: chk.error });
      }
      for (const p of posts) {
        const isAutoApprove = p.author?.auto_approve || req.user.role === 'admin';
        const updated = await prisma.post.update({
          where: { id: p.id },
          data: { 
            requested_signage: true, 
            allowed_on_signage: isAutoApprove,
            ...(publishFeed && { requested_feed: true, allowed_on_feed: isAutoApprove }) 
          },
          include: { images: true, signage_metadata: true }
        });
        const targetIds = selectedDeviceIds.length > 0 ? selectedDeviceIds : p.signage_deployments.map(d => d.device_id);
        if (targetIds.length > 0) {
          const targetDevices = await prisma.device.findMany({ where: { id: { in: targetIds } } });
          await deployToSignage(
            req,
            updated,
            targetDevices,
            updated.signage_metadata || {},
          );
        }
      }
    }
    res.json({ ok: true, count: validIds.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
