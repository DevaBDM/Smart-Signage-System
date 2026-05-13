const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");

const requireDeviceKeyIfConfigured = (req, res, next) => {
  if (!process.env.DEVICE_API_KEY) return next();
  if (req.headers["x-device-api-key"] === process.env.DEVICE_API_KEY) {
    return next();
  }
  return res.status(401).json({ error: "Invalid device API key" });
};

// Log sensor data (called from Pi via REST as backup, main path is Socket.IO)
router.post("/log", requireDeviceKeyIfConfigured, async (req, res) => {
  const { device_id, motion, brightness, rain } = req.body;
  try {
    const log = await prisma.sensorLog.create({
      data: {
        device_id: Number(device_id),
        motion: Boolean(motion),
        brightness: Number(brightness) || 0,
        rain: Boolean(rain),
      },
    });
    res.json(log);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Get logs for a device
router.get("/:device_id", auth(["admin"]), async (req, res) => {
  const logs = await prisma.sensorLog.findMany({
    where: { device_id: Number(req.params.device_id) },
    orderBy: { created_at: "desc" },
    take: 100,
  });
  res.json(logs);
});

module.exports = router;
