const { Server } = require("socket.io");
const prisma = require("../db/prisma");
const { upsertSignageAsset } = require("../utils/signageAssets");

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
        .upsert({
          where: { id },
          update: {
            device_name: data.device_name || undefined,
            ip_address: data.ip_address || undefined,
            location: data.location || undefined,
            status: "online",
            last_seen: new Date(),
          },
          create: {
            id,
            device_name: data.device_name || `Pi Display ${id}`,
            ip_address:
              data.ip_address ||
              socket.handshake.address ||
              `socket-${socket.id}`,
            location: data.location || null,
            status: "online",
            last_seen: new Date(),
          },
        })
        .catch(async () => {
          await prisma.device
            .updateMany({
              where: { id },
              data: { status: "online", last_seen: new Date() },
            })
            .catch(() => {});
        });

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

    socket.on("signage_asset_synced", async (data) => {
      await upsertSignageAsset(prisma, {
        device_id: data.device_id,
        post_id: data.post_id,
        image_url: data.image_url,
        asset: data.asset,
      }).catch(() => {});
      if (data.post_id) {
        await prisma.signageDeployment
          .update({
            where: {
              device_id_post_id: {
                device_id: Number(data.device_id),
                post_id: Number(data.post_id),
              },
            },
            data: { status: "synced", last_error: null },
          })
          .catch(() => {});
      }
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

  const emitToDeviceAck = (device_id, event, data, timeout = 10000) =>
    new Promise((resolve) => {
      const socketId = deviceSockets.get(Number(device_id));
      if (!socketId) {
        resolve({ ok: false, offline: true, error: "Device is offline" });
        return;
      }

      io.timeout(timeout).to(socketId).emit(event, data, (err, responses) => {
        if (err) {
          resolve({ ok: false, error: "Device did not respond in time" });
          return;
        }
        resolve(responses?.[0] || { ok: true });
      });
    });

  // ── Offline detection: mark devices offline if no heartbeat for 30s ─
  setInterval(async () => {
    const cutoff = new Date(Date.now() - 30_000);
    await prisma.device.updateMany({
      where: { status: "online", last_seen: { lt: cutoff } },
      data: { status: "offline" },
    });
  }, 15_000);

  return { io, emitToDevice, emitToDeviceAck };
};
