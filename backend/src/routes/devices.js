const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const {
  registerDevice,
  approveDevice,
  rejectDevice,
  updateDeviceSettings,
  resetDevice,
  removeDevice,
} = require("../services/deviceService");

// List devices. Admins see all; creators see displays in their group or all groups.
router.get("/", auth(["admin", "creator"]), async (req, res) => {
  const { sortBy = "id", sortOrder = "asc" } = req.query;
  const allowedGroupIds = [
    req.user.group_id,
    ...(req.user.managed_group_ids || []),
  ].filter(Boolean);
  const where =
    req.user.role === "admin"
      ? {}
      : {
          OR: [
            { all_groups: true },
            { group_id: { in: allowedGroupIds } },
            { groups: { some: { group_id: { in: allowedGroupIds } } } },
          ],
        };

  // Validate sort parameters to prevent Prisma errors
  const validFields = ["id", "device_name", "status", "last_seen", "created_at"];
  const finalSortBy = validFields.includes(sortBy) ? sortBy : "id";
  const finalSortOrder = sortOrder === "desc" ? "desc" : "asc";

  const devices = await prisma.device.findMany({
    where,
    include: { group: true, groups: { include: { group: true } } },
    orderBy: { [finalSortBy]: finalSortOrder },
  });
  res.json(devices);
});

// Get single device
router.get("/:id", auth(["admin"]), async (req, res) => {
  const device = await prisma.device.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      group: true,
      groups: { include: { group: true } },
      sensor_logs: { orderBy: { created_at: "desc" }, take: 50 },
    },
  });
  if (!device) return res.status(404).json({ error: "Not found" });
  res.json(device);
});

// Register device from the admin dashboard.
router.post("/register", auth(["admin"]), async (req, res) => {
  try {
    const device = await registerDevice(req.body);
    res.json(device);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

// Approve a device or its pending changes (optionally apply group settings from body).
router.post("/:id/approve", auth(["admin"]), async (req, res) => {
  try {
    const updated = await approveDevice(Number(req.params.id), req.body);
    res.json(updated);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

// Reject/Clear pending changes or unapproved device.
router.post("/:id/reject", auth(["admin"]), async (req, res) => {
  try {
    const result = await rejectDevice(Number(req.params.id));
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

// Update device settings after auto-registration.
router.put("/:id", auth(["admin"]), async (req, res) => {
  try {
    const device = await updateDeviceSettings(Number(req.params.id), req.body);
    res.json(device);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

// Reset device to agent defaults.
router.put("/:id/reset", auth(["admin"]), async (req, res) => {
  try {
    const device = await resetDevice(Number(req.params.id));
    res.json({ message: "Device settings cleared. Waiting for next heartbeat to sync agent defaults.", device });
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

// Remove device and clear ALL signage data from it.
router.delete("/:id", auth(["admin"]), async (req, res) => {
  try {
    const result = await removeDevice(Number(req.params.id));
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

module.exports = router;
