const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");

// List devices. Admins see all; creators see their department displays.
router.get("/", auth(["admin", "creator"]), async (req, res) => {
  const where =
    req.user.role === "admin" ? {} : { department_id: req.user.department_id };
  const devices = await prisma.device.findMany({
    where,
    include: { department: true },
    orderBy: { last_seen: "desc" },
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
  const { device_name, ip_address, department_id } = req.body;
  try {
    const device = await prisma.device.upsert({
      where: { ip_address },
      update: { device_name, department_id: department_id ? Number(department_id) : null },
      create: { device_name, ip_address, department_id: department_id ? Number(department_id) : null },
    });
    res.json(device);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
