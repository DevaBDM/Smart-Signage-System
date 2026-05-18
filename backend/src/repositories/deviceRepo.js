const prisma = require("../db/prisma");

const findDeviceById = (id, include = {}) =>
  prisma.device.findUnique({ where: { id: Number(id) }, include });

const findDevices = (where, orderBy, include = {}) =>
  prisma.device.findMany({ where, orderBy, include });

const createDevice = (data) =>
  prisma.device.create({
    data,
    include: { group: true, groups: { include: { group: true } } },
  });

const updateDevice = (id, data) =>
  prisma.device.update({
    where: { id: Number(id) },
    data,
    include: { group: true, groups: { include: { group: true } } },
  });

const deleteDevice = (id) =>
  prisma.device.delete({ where: { id: Number(id) } });

const deleteDeviceGroups = (deviceId) =>
  prisma.deviceGroup.deleteMany({ where: { device_id: Number(deviceId) } });

const transaction = (fn) => prisma.$transaction(fn);

module.exports = {
  findDeviceById,
  findDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  deleteDeviceGroups,
  transaction,
};
