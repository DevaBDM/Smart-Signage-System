const router = require("express").Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { getActor } = require("../utils/permissions");
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

module.exports = router;
