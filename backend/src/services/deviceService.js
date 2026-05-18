const deviceRepo = require("../repositories/deviceRepo");
const { toBool, parseGroupIds } = require("../utils/parsers");
const piBridge = require("./piBridge");

async function registerDevice(body) {
  const { id, device_name, ip_address, group_id, location } = body;
  const groupIds = parseGroupIds(body.group_ids);
  const allGroups = toBool(body.all_groups);

  try {
    return await deviceRepo.createDevice({
      ...(id && { id: Number(id) }),
      device_name,
      ip_address,
      location: location || null,
      group_id: group_id ? Number(group_id) : null,
      all_groups: allGroups,
      is_approved: true,
      groups: {
        create: groupIds.map((g_id) => ({ group_id: g_id })),
      },
    });
  } catch (e) {
    if (e.code === "P2002") {
      throw Object.assign(
        new Error(`Device ID ${id} is already registered.`),
        { statusCode: 400 },
      );
    }
    throw e;
  }
}

async function approveDevice(deviceId, body) {
  const device = await deviceRepo.findDeviceById(deviceId);
  if (!device) throw Object.assign(new Error("Not found"), { statusCode: 404 });

  const groupIds =
    body.group_ids !== undefined ? parseGroupIds(body.group_ids) : null;
  const groupId =
    body.group_id !== undefined
      ? body.group_id
        ? Number(body.group_id)
        : null
      : undefined;

  const updateData = {
    is_approved: true,
    ...(device.pending_name && { device_name: device.pending_name, pending_name: null }),
    ...(device.pending_ip && { ip_address: device.pending_ip, pending_ip: null }),
    ...(device.pending_location && { location: device.pending_location, pending_location: null }),
    ...(body.all_groups !== undefined && { all_groups: toBool(body.all_groups) }),
    ...(groupId !== undefined && { group_id: groupId }),
  };

  return deviceRepo.transaction(async (tx) => {
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
}

async function rejectDevice(deviceId) {
  const device = await deviceRepo.findDeviceById(deviceId);
  if (!device) throw Object.assign(new Error("Not found"), { statusCode: 404 });

  if (!device.is_approved) {
    await deviceRepo.deleteDevice(deviceId);
    return { message: "Unapproved device registration rejected and deleted." };
  }

  return deviceRepo.updateDevice(deviceId, {
    pending_name: null,
    pending_ip: null,
    pending_location: null,
  });
}

async function updateDeviceSettings(deviceId, body) {
  const { device_name, ip_address, group_id, location } = body;
  const groupIds =
    body.group_ids !== undefined ? parseGroupIds(body.group_ids) : null;

  return deviceRepo.transaction(async (tx) => {
    if (groupIds !== null) {
      await tx.deviceGroup.deleteMany({
        where: { device_id: Number(deviceId) },
      });
    }
    return tx.device.update({
      where: { id: Number(deviceId) },
      data: {
        ...(device_name !== undefined && { device_name }),
        ...(ip_address !== undefined && { ip_address }),
        ...(location !== undefined && { location: location || null }),
        ...(body.all_groups !== undefined && {
          all_groups: toBool(body.all_groups),
        }),
        ...(group_id !== undefined && {
          group_id: group_id ? Number(group_id) : null,
        }),
        ...(body.status !== undefined && { status: body.status }),
        ...(groupIds !== null && {
          groups: {
            create: groupIds.map((g_id) => ({ group_id: g_id })),
          },
        }),
      },
      include: { group: true, groups: { include: { group: true } } },
    });
  });
}

async function resetDevice(deviceId) {
  return deviceRepo.updateDevice(deviceId, {
    device_name: `Pi Display ${deviceId}`,
    location: null,
    ip_address: "",
  });
}

async function removeDevice(deviceId) {
  const device = await deviceRepo.findDeviceById(deviceId);
  if (!device) throw Object.assign(new Error("Device not found"), { statusCode: 404 });

  const emitter = piBridge.getEmitter();
  if (emitter) {
    await emitter(deviceId, "signage_command", { action: "clear_all" }, 5000).catch(() => {});
  }

  await deviceRepo.deleteDevice(deviceId);
  return { ok: true, message: "Device and all its signage data removed." };
}

module.exports = {
  registerDevice,
  approveDevice,
  rejectDevice,
  updateDeviceSettings,
  resetDevice,
  removeDevice,
};
