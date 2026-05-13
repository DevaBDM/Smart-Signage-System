const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");

// List all devices
router.get("/", auth(["admin"]), async (req, res) => {
  const devices = await prisma.device.findMany({
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

// Register device (called once manually or on first boot)
router.post("/register", async (req, res) => {
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
