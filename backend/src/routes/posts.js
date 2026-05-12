const router = require("express").Router();
const pool = require("../db/pool");
const auth = require("../middleware/auth");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (_, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

router.post(
  "/",
  auth(["admin", "content_creator"]),
  upload.single("image"),
  async (req, res) => {
    const { title, target_device_id } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await pool.query(
      "INSERT INTO posts (title, image_url, published_by, target_device_id) VALUES ($1,$2,$3,$4) RETURNING *",
      [title, image_url, req.user.id, target_device_id],
    );
    res.json(result.rows[0]);
  },
);

router.get("/", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM posts ORDER BY created_at DESC",
  );
  res.json(result.rows);
});

router.delete("/:id", auth(["admin"]), async (req, res) => {
  await pool.query("DELETE FROM posts WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
