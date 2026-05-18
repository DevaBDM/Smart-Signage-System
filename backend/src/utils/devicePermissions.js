const prisma = require("../db/prisma");
const { getActor } = require("./permissions");

const canUseDevice = (user, device) => {
  if (user.role === "admin") return true;
  if (device.all_groups) return true;
  const allowedGroupIds = [
    user.group_id,
    ...(user.managed_group_ids || []),
  ].filter(Boolean);
  if (allowedGroupIds.includes(device.group_id)) return true;
  if (device.groups?.some((m) => allowedGroupIds.includes(m.group_id))) return true;
  return false;
};

const getAllowedDevice = async (req, res) => {
  const actor = await getActor(req.user);
  const device = await prisma.device.findUnique({
    where: { id: Number(req.params.device_id || req.body.device_id) },
    include: { groups: true },
  });
  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return null;
  }
  if (!device.is_approved) {
    res.status(403).json({
      error: "This device is pending approval and cannot be controlled yet.",
    });
    return null;
  }
  if (!canUseDevice(actor, device)) {
    res.status(403).json({ error: "Cannot control this device" });
    return null;
  }
  if (device.status !== "online") {
    res.status(400).json({
      error: `Display "${device.device_name}" is offline. Operation cancelled.`,
    });
    return null;
  }
  return device;
};

module.exports = { canUseDevice, getAllowedDevice };
