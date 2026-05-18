const router = require("express").Router();
const prisma = require("../db/prisma");
const auth = require("../middleware/auth");
const { toBool, parseGroupIds } = require("../utils/parsers");
const piBridge = require("../services/piBridge");

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
  const { id, device_name, ip_address, group_id, location } = req.body;
  const groupIds = parseGroupIds(req.body.group_ids);
  const allGroups = toBool(req.body.all_groups);
  try {
    const device = await prisma.device.create({
      data: {
        ...(id && { id: Number(id) }),
        device_name,
        ip_address,
        location: location || null,
        group_id: group_id ? Number(group_id) : null,
        all_groups: allGroups,
        is_approved: true, // Manual registration is auto-approved
        groups: {
          create: groupIds.map((g_id) => ({ group_id: g_id })),
        },
      },
      include: { group: true, groups: { include: { group: true } } },
    });
    res.json(device);
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(400).json({ 
        error: `Device ID ${id} is already registered.` 
      });
    }
    res.status(400).json({ error: e.message });
  }
});

// Approve a device or its pending changes (optionally apply group settings from body).
router.post("/:id/approve", auth(["admin"]), async (req, res) => {
  try {
    const deviceId = Number(req.params.id);
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) return res.status(404).json({ error: "Not found" });

    const groupIds =
      req.body.group_ids !== undefined ? parseGroupIds(req.body.group_ids) : null;
    const groupId =
      req.body.group_id !== undefined
        ? req.body.group_id
          ? Number(req.body.group_id)
          : null
        : undefined;

    const updateData = {
      is_approved: true,
      ...(device.pending_name && { device_name: device.pending_name, pending_name: null }),
      ...(device.pending_ip && { ip_address: device.pending_ip, pending_ip: null }),
      ...(device.pending_location && { location: device.pending_location, pending_location: null }),
      ...(req.body.all_groups !== undefined && { all_groups: toBool(req.body.all_groups) }),
      ...(groupId !== undefined && { group_id: groupId }),
    };

    const updated = await prisma.$transaction(async (tx) => {
      if (groupIds !== null) {
        await tx.deviceGroup.deleteMany({ where: { device_id: deviceId } });
      }
      return tx.device.update({
        where: { id: deviceId },
        data: {
          ...updateData,
          ...(groupIds !== null && {
            groups: { create: groupIds.map((g_id) => ({ group_id: g_id })) },
          }),
        },
        include: { group: true, groups: { include: { group: true } } },
      });
    });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Reject/Clear pending changes or unapproved device.
router.post("/:id/reject", auth(["admin"]), async (req, res) => {
  try {
    const device = await prisma.device.findUnique({ where: { id: Number(req.params.id) } });
    if (!device) return res.status(404).json({ error: "Not found" });

    if (!device.is_approved) {
      // If it was never approved, rejection means deletion
      await prisma.device.delete({ where: { id: Number(req.params.id) } });
      return res.json({ message: "Unapproved device registration rejected and deleted." });
    }

    // Otherwise, just clear the pending changes
    const updated = await prisma.device.update({
      where: { id: Number(req.params.id) },
      data: { pending_name: null, pending_ip: null, pending_location: null },
    });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Update device settings after auto-registration.
router.put("/:id", auth(["admin"]), async (req, res) => {
  const { device_name, ip_address, group_id, location } = req.body;
  const groupIds =
    req.body.group_ids !== undefined ? parseGroupIds(req.body.group_ids) : null;
  try {
    const device = await prisma.$transaction(async (tx) => {
      if (groupIds !== null) {
        await tx.deviceGroup.deleteMany({
          where: { device_id: Number(req.params.id) },
        });
      }
      return tx.device.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(device_name !== undefined && { device_name }),
        ...(ip_address !== undefined && { ip_address }),
        ...(location !== undefined && { location: location || null }),
        ...(req.body.all_groups !== undefined && {
          all_groups: toBool(req.body.all_groups),
        }),
        ...(group_id !== undefined && {
          group_id: group_id ? Number(group_id) : null,
        }),
        ...(req.body.status !== undefined && { status: req.body.status }),
        ...(groupIds !== null && {
          groups: {
            create: groupIds.map((g_id) => ({ group_id: g_id })),
          },
        }),
      },
      include: { group: true, groups: { include: { group: true } } },
      });
    });
    res.json(device);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Reset device to agent defaults.
router.put("/:id/reset", auth(["admin"]), async (req, res) => {
  try {
    const device = await prisma.device.update({
      where: { id: Number(req.params.id) },
      data: {
        device_name: `Pi Display ${req.params.id}`, // Placeholder until next heartbeat
        location: null,
        ip_address: "", // Clear IP so heartbeat can re-verify it
      },
    });
    res.json({ message: "Device settings cleared. Waiting for next heartbeat to sync agent defaults.", device });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Remove device and clear ALL signage data from it.
router.delete("/:id", auth(["admin"]), async (req, res) => {
  try {
    const device_id = Number(req.params.id);
    const device = await prisma.device.findUnique({ where: { id: device_id } });
    if (!device) return res.status(404).json({ error: "Device not found" });

    // 1. Notify Pi to clear ALL Anthias assets (best effort if online)
    const emitter = piBridge.getEmitter();
    if (emitter) {
      await emitter(device_id, "signage_command", { action: "clear_all" }, 5000).catch(() => {});
    }

    // 2. Cascade delete will handle related records in deployments, assets, logs, etc.
    // Ensure migrations/schema.prisma has onDelete: Cascade for these relations.
    await prisma.device.delete({ where: { id: device_id } });

    res.json({ ok: true, message: "Device and all its signage data removed." });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
