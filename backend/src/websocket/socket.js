const { Server } = require("socket.io");
const prisma = require("../db/prisma");

// Track connected Pi sockets: device_id → socket.id
const deviceSockets = new Map();

module.exports = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // ── Pi → Server: register and heartbeat ──────────────────
    socket.on("heartbeat", async (data) => {
      // data: { device_id, status, timestamp }
      const id = Number(data.device_id);
      deviceSockets.set(id, socket.id);
      socket.deviceId = id;

      await prisma.device
        .update({
          where: { id },
          data: { status: "online", last_seen: new Date() },
        })
        .catch(() => {});

      console.log(`[socket] heartbeat from device ${id}`);
    });

    // ── Pi → Server: sensor data ─────────────────────────────
    socket.on("sensor_update", async (data) => {
      // data: { device_id, motion, brightness, rain }
      await prisma.sensorLog
        .create({
          data: {
            device_id: Number(data.device_id),
            motion: Boolean(data.motion),
            brightness: Number(data.brightness) || 0,
            rain: Boolean(data.rain),
          },
        })
        .catch(() => {});
    });

    // ── Pi → Server: error report ─────────────────────────────
    socket.on("error_log", async (data) => {
      // data: { device_id, error_type, message }
      await prisma.errorLog
        .create({
          data: {
            device_id: Number(data.device_id),
            error_type: data.error_type,
            message: data.message,
          },
        })
        .catch(() => {});
    });

    // ── Pi → Server: playlist confirmed ──────────────────────
    socket.on("playlist_ack", (data) => {
      console.log(
        `[socket] device ${data.device_id} confirmed playlist update`,
      );
    });

    // ── Disconnect: mark offline ──────────────────────────────
    socket.on("disconnect", async () => {
      if (socket.deviceId) {
        deviceSockets.delete(socket.deviceId);
        await prisma.device
          .update({
            where: { id: socket.deviceId },
            data: { status: "offline" },
          })
          .catch(() => {});
        console.log(
          `[socket] device ${socket.deviceId} disconnected → offline`,
        );
      }
    });
  });

  // ── Helpers to push events TO specific Pi ────────────────────
  const emitToDevice = (device_id, event, data) => {
    const socketId = deviceSockets.get(Number(device_id));
    if (socketId) {
      io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  };

  // ── Offline detection: mark devices offline if no heartbeat for 30s ─
  setInterval(async () => {
    const cutoff = new Date(Date.now() - 30_000);
    await prisma.device.updateMany({
      where: { status: "online", last_seen: { lt: cutoff } },
      data: { status: "offline" },
    });
  }, 15_000);

  return { io, emitToDevice };
};
