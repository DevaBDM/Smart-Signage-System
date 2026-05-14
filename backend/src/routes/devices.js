const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");

// List devices. Admins see all; creators see their department displays.
router.get("/", auth(["admin", "creator"]), async (req, res) => {
  const { sortBy = "id", sortOrder = "asc" } = req.query;
  const where =
    req.user.role === "admin" ? {} : { department_id: req.user.department_id };

  // Validate sort parameters to prevent Prisma errors
  const validFields = ["id", "device_name", "status", "last_seen", "created_at"];
  const finalSortBy = validFields.includes(sortBy) ? sortBy : "id";
  const finalSortOrder = sortOrder === "desc" ? "desc" : "asc";

  const devices = await prisma.device.findMany({
    where,
    include: { department: true },
    orderBy: { [finalSortBy]: finalSortOrder },
  });
  res.json(devices);
});

// Get single device
router.get("/:id", auth(["admin"]), async (req, res) => {
  const device = await prisma.device.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      department: true,
      sensor_logs: { orderBy: { created_at: "desc" }, take: 50 },
    },
  });
  if (!device) return res.status(404).json({ error: "Not found" });
  res.json(device);
});

// Register device from the admin dashboard.
router.post("/register", auth(["admin"]), async (req, res) => {
  const { id, device_name, ip_address, department_id, location } = req.body;
  try {
    let device;
    if (id) {
      // If ID is provided, try to find and update, else create
      device = await prisma.device.upsert({
        where: { id: Number(id) },
        update: {
          device_name,
          ip_address,
          location: location || null,
          department_id: department_id ? Number(department_id) : null,
        },
        create: {
          id: Number(id),
          device_name,
          ip_address,
          location: location || null,
          department_id: department_id ? Number(department_id) : null,
        },
      });
    } else {
      // If no ID, find by IP (now non-unique, so we take the first) or just create
      const existing = await prisma.device.findFirst({
        where: { ip_address },
      });
      if (existing) {
        device = await prisma.device.update({
          where: { id: existing.id },
          data: {
            device_name,
            location: location || null,
            department_id: department_id ? Number(department_id) : null,
          },
        });
      } else {
        device = await prisma.device.create({
          data: {
            device_name,
            ip_address,
            location: location || null,
            department_id: department_id ? Number(department_id) : null,
          },
        });
      }
    }
    res.json(device);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Update device settings after auto-registration.
router.put("/:id", auth(["admin"]), async (req, res) => {
  const { device_name, ip_address, department_id, location } = req.body;
  try {
    const device = await prisma.device.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(device_name !== undefined && { device_name }),
        ...(ip_address !== undefined && { ip_address }),
        ...(location !== undefined && { location: location || null }),
        ...(department_id !== undefined && {
          department_id: department_id ? Number(department_id) : null,
        }),
      },
      include: { department: true },
    });
    res.json(device);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
