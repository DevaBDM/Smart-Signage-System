const prisma = require("../db/prisma");

/** Ask online displays in a group to refresh after signage mode changes. */
async function refreshGroupDevices(app, groupId) {
  const emitToDevice = app.get("emitToDevice");
  if (!emitToDevice) return;

  const devices = await prisma.device.findMany({
    where: {
      is_approved: true,
      status: "online",
      OR: [
        { group_id: groupId },
        { groups: { some: { group_id: groupId } } },
      ],
    },
    select: { id: true },
  });

  for (const device of devices) {
    emitToDevice(device.id, "refresh_display", { reason: "group_signage_state" });
  }
}

module.exports = { refreshGroupDevices };
