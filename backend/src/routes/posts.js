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
