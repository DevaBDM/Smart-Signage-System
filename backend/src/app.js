const express = require("express");
const cors = require("cors");
const path = require("path");
const { UPLOAD_ROOT } = require("./utils/mediaProcessor");

const app = express();
const UPLOADS_DIR = path.resolve(UPLOAD_ROOT);
const STREAMS_DIR = process.env.STREAMS_DIR || path.resolve(__dirname, "../streams");

app.use(cors());
app.use(express.json());

app.use("/uploads", require("./routes/uploads"));

// Static HLS serving — no-store for playlists, short cache for segments
app.use("/streams", express.static(STREAMS_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".m3u8")) {
      res.setHeader("Cache-Control", "no-store");
    }
  },
}));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/groups", require("./routes/groups"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/devices", require("./routes/devices"));
app.use("/api/sensors", require("./routes/sensors"));
app.use("/api/playlists", require("./routes/playlists"));
app.use("/api/signage", require("./routes/signage"));
app.use("/api/users", require("./routes/users"));
app.use("/api/media", require("./routes/media"));
app.use("/api/live-streams", require("./routes/liveStreams"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uploads_dir: UPLOADS_DIR });
});

app.use(require("./middleware/error"));

module.exports = app;
