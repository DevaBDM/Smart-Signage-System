const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const authDevice = require("../middleware/authDevice");
const asyncHandler = require("../middleware/asyncHandler");
const {
  registerDevice,
  approveDevice,
  rejectDevice,
  updateDeviceSettings,
  resetDevice,
  removeDevice,
} = require("../services/deviceService");
const { getActorGroupIds } = require("../utils/permissions");
const { processImage, processVideo, TEMP_DIR, isImageMime, isVideoMime } = require("../utils/mediaProcessor");

const emergencyUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TEMP_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype || "";
    if (isImageMime(mime) || isVideoMime(mime)) return cb(null, true);
    return cb(new Error("Only image or video files are allowed"));
  },
});

function handleEmergencyUpload(req, res, next) {
  emergencyUpload.single("asset")(req, res, (err) => {
    if (!err) return next();
    const message = err.code === "LIMIT_FILE_SIZE"
      ? "Asset must be 200 MB or smaller"
      : err.message || "Emergency asset upload failed";
    return res.status(400).json({ error: message });
  });
}

// List devices. Admins see all; creators see displays in their group or all groups.
router.get("/", auth(["admin", "creator"]), async (req, res) => {
  const { sortBy = "id", sortOrder = "asc" } = req.query;
  const allowedGroupIds = getActorGroupIds(req.user);
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

// Device-authenticated: a Pi reads its own record (emergency_asset_path, etc.)
// MUST be registered BEFORE /:id so Express matches /me first.
router.get("/me", authDevice, asyncHandler(async (req, res) => {
  const device = await prisma.device.findUnique({
    where: { id: req.device.id },
    include: {
      group: true,
      groups: { include: { group: true } },
      sensor_logs: { orderBy: { created_at: "desc" }, take: 50 },
    },
  });
  if (!device) return res.status(404).json({ error: "Not found" });
  res.json(device);
}));

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
router.post("/register", auth(["admin"]), asyncHandler(async (req, res) => {
  const device = await registerDevice(req.body);
  res.json(device);
}));

// Approve a device or its pending changes (optionally apply group settings from body).
router.post("/:id/approve", auth(["admin"]), asyncHandler(async (req, res) => {
  const updated = await approveDevice(Number(req.params.id), req.body);
  res.json(updated);
}));

// Reject/Clear pending changes or unapproved device.
router.post("/:id/reject", auth(["admin"]), asyncHandler(async (req, res) => {
  const result = await rejectDevice(Number(req.params.id));
  res.json(result);
}));

// Update device settings after auto-registration.
router.put("/:id", auth(["admin"]), asyncHandler(async (req, res) => {
  const device = await updateDeviceSettings(Number(req.params.id), req.body);
  res.json(device);
}));

// Reset device to agent defaults.
router.put("/:id/reset", auth(["admin"]), asyncHandler(async (req, res) => {
  const device = await resetDevice(Number(req.params.id));
  res.json({ message: "Device settings cleared. Waiting for next heartbeat to sync agent defaults.", device });
}));

// Remove device and clear ALL signage data from it.
router.delete("/:id", auth(["admin"]), asyncHandler(async (req, res) => {
  const result = await removeDevice(Number(req.params.id));
  res.json(result);
}));

// Upload emergency asset (image or video) for a device.
router.post(
  "/:id/emergency-asset",
  auth(["admin"]),
  handleEmergencyUpload,
  asyncHandler(async (req, res) => {
    const deviceId = Number(req.params.id);
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const mime = req.file.mimetype || "";
    let result;
    if (isImageMime(mime)) {
      result = await processImage(req.file.path, null);
    } else if (isVideoMime(mime)) {
      result = await processVideo(req.file.path, null);
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }
    const updated = await updateDeviceSettings(deviceId, {
      emergency_asset_path: result.image_path,
    });
    res.json({ emergency_asset_path: result.image_path, device: updated });
  })
);

module.exports = router;
