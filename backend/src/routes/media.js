const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const auth = require("../middleware/auth");
const { parseMediaCrops } = require("../utils/parseMediaCrops");
const {
  TEMP_DIR,
  isImageMime,
  isVideoMime,
  processMediaFile,
  probeVideo,
} = require("../utils/mediaProcessor");

const storage = multer.diskStorage({
  destination: TEMP_DIR,
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const mime = file.mimetype || "";
    const ext = path.extname(file.originalname).toLowerCase();
    const imageExt = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
    const videoExt = [".mp4", ".webm", ".mov", ".m4v"];
    if (isImageMime(mime) || imageExt.includes(ext)) return cb(null, true);
    if (isVideoMime(mime) || videoExt.includes(ext)) return cb(null, true);
    return cb(new Error("Only image or video files are allowed"));
  },
});

const uploadSingle = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File must be 200MB or smaller"
        : err.message || "Upload failed";
    return res.status(400).json({ error: message });
  });
};

/** Probe duration/dimensions before crop UI (optional). */
router.post("/probe", auth(["admin", "creator"]), uploadSingle, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  try {
    const mime = req.file.mimetype || "";
    if (isVideoMime(mime)) {
      const meta = await probeVideo(req.file.path);
      const video = meta.streams?.find((s) => s.codec_type === "video");
      return res.json({
        media_type: "VIDEO",
        duration_seconds: Number(meta.format?.duration) || 0,
        width: video?.width,
        height: video?.height,
      });
    }
    const sharp = require("sharp");
    const img = await sharp(req.file.path).metadata();
    res.json({
      media_type: "IMAGE",
      width: img.width,
      height: img.height,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  } finally {
    const fs = require("fs");
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});

/** Crop/trim on server; returns paths ready to attach to a post. */
router.post("/process", auth(["admin", "creator"]), uploadSingle, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  try {
    const crops = parseMediaCrops({ media_crops: req.body?.crop }, 1);
    const processed = await processMediaFile(req.file, crops[0]);
    res.json(processed);
  } catch (e) {
    res.status(400).json({ error: e.message || "Media processing failed" });
  }
});

module.exports = router;
