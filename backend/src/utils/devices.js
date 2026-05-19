/** Assert a single device is online (throws if not). */
function assertDeviceOnline(device) {
  if (device.status !== "online") {
    throw Object.assign(
      new Error(`Update cancelled. These displays are offline: ${device.device_name}`),
      { statusCode: 400 },
    );
  }
}

/** All listed displays must be online or the operation is rejected. */
async function ensureDevicesOnline(prisma, deviceIds) {
  if (!deviceIds?.length) return { ok: true };
  const offline = await prisma.device.findMany({
    where: { id: { in: deviceIds }, status: { not: "online" } },
  });
  if (offline.length > 0) {
    return {
      ok: false,
      error: `Update cancelled. These displays are offline: ${offline.map((d) => d.device_name).join(", ")}`,
    };
  }
  return { ok: true };
}

/** Set of device ids currently marked online (for optional socket work). */
async function getOnlineDeviceIdSet(prisma, deviceIds) {
  if (!deviceIds?.length) return new Set();
  const rows = await prisma.device.findMany({
    where: { id: { in: deviceIds }, status: "online" },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

module.exports = { assertDeviceOnline, ensureDevicesOnline, getOnlineDeviceIdSet };
