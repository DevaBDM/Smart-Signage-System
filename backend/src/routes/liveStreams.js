const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { getActor } = require("../utils/permissions");
const { processImage, TEMP_DIR } = require("../utils/mediaProcessor");
const {
  listForActor,
  createStream,
  updateStream,
  deleteStream,
  getStream,
  rotateStreamKey,
} = require("../services/liveStreamService");
const streamRelay = require("../services/streamRelay");
const liveStreamRepo = require("../repositories/liveStreamRepo");

const uploadThumb = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TEMP_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype || "";
    if (mime.startsWith("image/")) return cb(null, true);
    return cb(new Error("Only image files are allowed"));
  },
});

function handleThumbUpload(req, res, next) {
  uploadThumb.single("thumbnail")(req, res, (err) => {
    if (!err) return next();
    const message = err.code === "LIMIT_FILE_SIZE"
      ? "Thumbnail must be 10 MB or smaller"
      : err.message || "Thumbnail upload failed";
    return res.status(400).json({ error: message });
  });
}

router.get(
  "/",
  auth(["admin", "creator"]),
  asyncHandler(async (req, res) => {
    const actor = await getActor(req.user);
    const streams = await listForActor(actor);
    res.json(streams);
  })
);

router.get(
  "/:id",
  auth(["admin", "creator"]),
  asyncHandler(async (req, res) => {
    const actor = await getActor(req.user);
    const stream = await getStream(actor, Number(req.params.id));
    res.json(stream);
  })
);

router.post(
  "/",
  auth(["admin", "creator"]),
  asyncHandler(async (req, res) => {
    const actor = await getActor(req.user);
    const stream = await createStream(actor, req.body);
    res.status(201).json(stream);
  })
);

router.put(
  "/:id",
  auth(["admin", "creator"]),
  asyncHandler(async (req, res) => {
    const actor = await getActor(req.user);
    const stream = await updateStream(actor, Number(req.params.id), req.body);
    res.json(stream);
  })
);

router.delete(
  "/:id",
  auth(["admin", "creator"]),
  asyncHandler(async (req, res) => {
    const actor = await getActor(req.user);
    const force = req.query.force === "true";
    await deleteStream(actor, Number(req.params.id), force);
    res.json({ success: true });
  })
);

router.post(
  "/:id/start",
  auth(["admin", "creator"]),
  asyncHandler(async (req, res) => {
    const actor = await getActor(req.user);
    const stream = await getStream(actor, Number(req.params.id));
    const result = await streamRelay.start(stream);
    res.json(result);
  })
);

router.post(
  "/:id/stop",
  auth(["admin", "creator"]),
  asyncHandler(async (req, res) => {
    const actor = await getActor(req.user);
    await getStream(actor, Number(req.params.id));
    const result = await streamRelay.stop(Number(req.params.id));
    res.json(result);
  })
);

router.post(
  "/:id/rotate-key",
  auth(["admin", "creator"]),
  asyncHandler(async (req, res) => {
    const actor = await getActor(req.user);
    const result = await rotateStreamKey(actor, Number(req.params.id));
    res.json(result);
  })
);

router.get(
  "/:id/logs",
  auth(["admin", "creator"]),
  asyncHandler(async (req, res) => {
    const actor = await getActor(req.user);
    const stream = await getStream(actor, Number(req.params.id));
    const limit = Number(req.query.limit) || 100;
    const logs = streamRelay.getLogs(stream.id, limit);
    res.json({
      stream_id: stream.id,
      stream_type: stream.stream_type,
      status: stream.status,
      logs,
    });
  })
);

router.post(
  "/:id/thumbnail",
  auth(["admin", "creator"]),
  handleThumbUpload,
  asyncHandler(async (req, res) => {
    const actor = await getActor(req.user);
    const stream = await getStream(actor, Number(req.params.id));
    if (!req.file) {
      return res.status(400).json({ error: "No thumbnail file uploaded" });
    }
    const result = await processImage(req.file.path, null);
    await liveStreamRepo.update(stream.id, { thumbnail_path: result.image_path });
    res.json({ thumbnail_path: result.image_path });
  })
);

module.exports = router;
