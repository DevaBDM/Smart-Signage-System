const express = require("express");
const path = require("path");
const fs = require("fs");
const { UPLOAD_ROOT } = require("../utils/mediaProcessor");

const router = express.Router();
const UPLOADS_DIR = path.resolve(UPLOAD_ROOT);

const uploadCors = (_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
};

/** Safe path check (Windows-safe; avoids brittle string startsWith). */
const isPathInside = (filePath, parentDir) => {
  const rel = path.relative(parentDir, filePath);
  return Boolean(rel) && !rel.startsWith("..") && !path.isAbsolute(rel);
};

const sendUploadFile = (subdir, filename, res) => {
  const safe = path.basename(String(filename || ""));
  if (!safe) return res.status(400).send("Bad filename");

  const subdirRoot = path.resolve(UPLOADS_DIR, subdir);
  const filePath = path.resolve(subdirRoot, safe);

  if (!isPathInside(filePath, subdirRoot) || !fs.existsSync(filePath)) {
    console.warn(
      `[uploads] missing ${subdir}/${safe} (resolved ${filePath}, uploads_dir ${UPLOADS_DIR})`,
    );
    return res.status(404).send("Not found");
  }

  if (safe.endsWith(".mp4")) res.type("video/mp4");
  else if (safe.endsWith(".webm")) res.type("video/webm");
  else if (safe.endsWith(".webp")) res.type("image/webp");

  return res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      console.warn(`[uploads] sendFile failed ${subdir}/${safe}:`, err.message);
      res.status(500).send("Failed to send file");
    }
  });
};

router.get("/videos/:filename", uploadCors, (req, res) =>
  sendUploadFile("videos", req.params.filename, res),
);
router.get("/images/:filename", uploadCors, (req, res) =>
  sendUploadFile("images", req.params.filename, res),
);
router.get("/attachments/:filename", uploadCors, (req, res) => {
  const safe = path.basename(String(req.params.filename || ""));
  if (!safe) return res.status(400).send("Bad filename");

  const subdirRoot = path.resolve(UPLOADS_DIR, "attachments");
  const filePath = path.resolve(subdirRoot, safe);

  if (!isPathInside(filePath, subdirRoot) || !fs.existsSync(filePath)) {
    return res.status(404).send("Not found");
  }

  // Set Content-Disposition for download (unless ?preview=1)
  if (!req.query.preview) {
    const downloadName = req.query.filename ? String(req.query.filename) : safe;
    res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
  }

  return res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      res.status(500).send("Failed to send file");
    }
  });
});

router.use(
  "/",
  uploadCors,
  express.static(UPLOADS_DIR, {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".mp4")) res.setHeader("Content-Type", "video/mp4");
      if (filePath.endsWith(".webm")) res.setHeader("Content-Type", "video/webm");
    },
  }),
);

module.exports = router;
