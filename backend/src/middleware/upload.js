const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const {
  TEMP_DIR,
  isImageMime,
  isVideoMime,
} = require("../utils/mediaProcessor");

const storage = multer.diskStorage({
  destination: TEMP_DIR,
  filename: (_, file, cb) =>
    cb(
      null,
      `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${path.extname(file.originalname)}`,
    ),
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype || "";
    const imageExt = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
    const videoExt = [".mp4", ".webm", ".mov", ".m4v"];
    if (isImageMime(mime) || imageExt.includes(ext)) return cb(null, true);
    if (isVideoMime(mime) || videoExt.includes(ext)) return cb(null, true);
    return cb(new Error("Only image or video files are allowed"));
  },
});

const uploadMedia = (req, res, next) => {
  upload.array("images", 10)(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Each file must be 200MB or smaller"
        : err.message || "Media upload failed";
    return res.status(400).json({ error: message });
  });
};

module.exports = { uploadMedia };
