const prisma = require("../db/prisma");

/** Notify online displays in a group when signage state changes.
 *  Emits emergency_mode_start when switching TO EMERGENCY,
 *  emergency_mode_end when switching FROM EMERGENCY,
 *  and refresh_display for all other state changes.
 */
async function refreshGroupDevices(app, groupId, newState, oldState) {
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

  const isEmergencyStart = newState === "EMERGENCY" && oldState !== "EMERGENCY";
  const isEmergencyEnd   = oldState === "EMERGENCY" && newState !== "EMERGENCY";

  for (const device of devices) {
    if (isEmergencyStart) {
      emitToDevice(device.id, "emergency_mode_start", {
        triggered_by: "admin",
        group_id: groupId,
      });
    } else if (isEmergencyEnd) {
      emitToDevice(device.id, "emergency_mode_end", {
        cleared_by: "admin",
        group_id: groupId,
      });
    } else {
      emitToDevice(device.id, "refresh_display", { reason: "group_signage_state" });
    }
  }
}

module.exports = { refreshGroupDevices };
