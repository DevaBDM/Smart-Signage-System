const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { UPLOAD_ROOT } = require("./utils/mediaProcessor");

const app = express();

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

app.use(cors());
app.use(express.json());

app.get("/uploads/videos/:filename", uploadCors, (req, res) =>
  sendUploadFile("videos", req.params.filename, res),
);
app.get("/uploads/images/:filename", uploadCors, (req, res) =>
  sendUploadFile("images", req.params.filename, res),
);

app.use(
  "/uploads",
  uploadCors,
  express.static(UPLOADS_DIR, {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".mp4")) res.setHeader("Content-Type", "video/mp4");
      if (filePath.endsWith(".webm")) res.setHeader("Content-Type", "video/webm");
    },
  }),
);

app.use("/api/auth", require("./routes/auth"));
app.use("/api/groups", require("./routes/groups"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/devices", require("./routes/devices"));
app.use("/api/sensors", require("./routes/sensors"));
app.use("/api/playlists", require("./routes/playlists"));
app.use("/api/signage", require("./routes/signage"));
app.use("/api/users", require("./routes/users"));
app.use("/api/media", require("./routes/media"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uploads_dir: UPLOADS_DIR });
});

module.exports = app;
