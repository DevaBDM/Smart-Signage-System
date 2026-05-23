const { Server } = require("socket.io");
const crypto = require("crypto");
const prisma = require("../db/prisma");
const { upsertSignageAsset } = require("../utils/signageAssets");

// Track connected Pi sockets: device_id → socket.id
const deviceSockets = new Map();

function generateDeviceToken() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  // ── Device token validation on connect ─────────────────────
  // Unregistered devices may connect without a token for their first
  // heartbeat. After the server assigns a token, the device must
  // present it on every subsequent connection.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      const device = await prisma.device.findFirst({
        where: { device_token: token },
      });
      if (device) {
        socket.deviceToken = token;
        socket.verifiedDeviceId = device.id;
        return next();
      }
      // Token present but invalid → reject
      return next(new Error("Invalid device token"));
    }
    // No token → allow for initial registration (heartbeat will create
    // the device record and emit a token back to the Pi).
    socket.verifiedDeviceId = null;
    next();
  });

  io.on("connection", (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // ── Pi → Server: register and heartbeat ──────────────────
    socket.on("heartbeat", async (data) => {
      // data: { device_id, device_name, ip_address, location, status }
      const id = Number(data.device_id);
      if (!id) return;

      // Reject heartbeats claiming a different device_id than the token
      if (socket.verifiedDeviceId && id !== socket.verifiedDeviceId) {
        console.warn(`[socket] heartbeat device_id mismatch: socket verified ${socket.verifiedDeviceId}, claimed ${id}`);
        socket.disconnect(true);
        return;
      }

      const reportedIp = data.ip_address;
      const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(reportedIp);
      const ip_address = isIp ? reportedIp : (socket.handshake.address || "unknown");

      const existing = await prisma.device.findUnique({ where: { id } });

      // ── HARDENING 1: Reject unknown device IDs ──────────────
      // Devices must be pre-registered via the admin API. Unknown IDs
      // are not silently accepted to prevent DB-flooding attacks.
      if (!existing) {
        console.warn(`[socket] heartbeat rejected: unknown device_id ${id}`);
        socket.emit("auth_error", { error: "Device not registered. Pre-register via admin dashboard." });
        socket.disconnect(true);
        return;
      }

      // ── HARDENING 2: Enforce token on reconnect ─────────────
      // Once a device has been assigned a token, every future connection
      // must present the correct token. Prevents hijack of known IDs.
      if (existing.device_token) {
        if (!socket.deviceToken || socket.deviceToken !== existing.device_token) {
          console.warn(`[socket] heartbeat rejected: device ${id} has token but socket presented none/invalid`);
          socket.emit("auth_error", { error: "Invalid or missing device token. Re-register required." });
          socket.disconnect(true);
          return;
        }
      }

      // Token verified (or device has no token yet). Track socket.
      deviceSockets.set(id, socket.id);
      socket.deviceId = id;

      // APPROVAL WORKFLOW & CHANGE DETECTION
      const nameChanged = data.device_name && existing.device_name !== data.device_name;
      const ipChanged = ip_address !== "unknown" && existing.ip_address !== ip_address;
      const locationChanged = data.location && existing.location !== data.location;

      let updateData = {
        status: "online",
        last_seen: new Date(),
      };

      // If the device is already approved, but sends a DIFFERENT name, IP, or Location,
      // we store these as "pending" for Admin review.
      if (existing.is_approved) {
        if (nameChanged) updateData.pending_name = data.device_name;
        if (ipChanged) updateData.pending_ip = ip_address;
        if (locationChanged) updateData.pending_location = data.location;
      } else {
        // If NOT yet approved, we keep updating its basic info so the admin sees current state
        if (data.device_name) updateData.device_name = data.device_name;
        if (ipChanged) updateData.ip_address = ip_address;
        if (data.location) updateData.location = data.location;
      }

      // Ensure every pre-registered device has a token; generate one if missing
      // and emit it back so the Pi can persist it for future connections.
      let tokenToEmit = null;
      if (!existing.device_token) {
        tokenToEmit = generateDeviceToken();
        updateData.device_token = tokenToEmit;
      } else if (!socket.deviceToken) {
        // Socket connected without a token but device already has one
        // (e.g., Pi lost its local config). Emit the existing token.
        tokenToEmit = existing.device_token;
      }

      await prisma.device.update({
        where: { id },
        data: updateData,
      });

      if (tokenToEmit) {
        socket.emit("device_token", { device_id: id, token: tokenToEmit });
        console.log(`[socket] emitted device_token to device ${id}`);
      }

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

    // ── Pi → Server: emergency button triggered ──────────────
    socket.on("emergency_trigger", async (data) => {
      const deviceId = Number(data.device_id);
      console.log(`[socket] emergency_trigger received from device ${deviceId}`, data);

      const device = await prisma.device.findUnique({
        where: { id: deviceId },
        include: { group: true, groups: { include: { group: true } } },
      });
      if (!device) {
        console.warn(`[socket] emergency_trigger: unknown device ${deviceId}`);
        return;
      }
      console.log(`[socket] emergency_trigger: device ${deviceId} found, group_id=${device.group_id}, memberships=${device.groups?.length || 0}`);

      // Collect all group IDs this device belongs to
      const groupIds = new Set();
      if (device.group_id) groupIds.add(device.group_id);
      for (const dg of device.groups || []) {
        if (dg.group_id) groupIds.add(dg.group_id);
      }
      if (groupIds.size === 0) {
        console.warn(`[socket] emergency_trigger: device ${deviceId} has no groups`);
        return;
      }
      console.log(`[socket] emergency_trigger: affecting groups [${Array.from(groupIds).join(", ")}]`);

      // Update each group's signage_state to EMERGENCY
      for (const gid of groupIds) {
        await prisma.group.update({
          where: { id: gid },
          data: { signage_state: "EMERGENCY" },
        }).catch((e) => {
          console.error(`[socket] failed to set group ${gid} to EMERGENCY:`, e.message);
        });
      }
      console.log(`[socket] emergency_trigger: updated ${groupIds.size} group(s) to EMERGENCY`);

      // Broadcast emergency_mode_start to ALL online devices in those groups
      const devicesInGroups = await prisma.device.findMany({
        where: {
          is_approved: true,
          status: "online",
          OR: [
            { group_id: { in: Array.from(groupIds) } },
            { groups: { some: { group_id: { in: Array.from(groupIds) } } } },
          ],
        },
        select: { id: true },
      });
      console.log(`[socket] emergency_trigger: found ${devicesInGroups.length} online device(s) in affected groups`);

      let broadcastCount = 0;
      for (const d of devicesInGroups) {
        const targetSocketId = deviceSockets.get(d.id);
        if (targetSocketId) {
          io.to(targetSocketId).emit("emergency_mode_start", {
            triggered_by: deviceId,
            groups: Array.from(groupIds),
          });
          broadcastCount++;
        } else {
          console.warn(`[socket] emergency_trigger: device ${d.id} is online but has no active socket`);
        }
      }
      console.log(`[socket] emergency_mode_start broadcast to ${broadcastCount}/${devicesInGroups.length} devices in groups [${Array.from(groupIds).join(", ")}]`);
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
  const offlineInterval = setInterval(async () => {
    const cutoff = new Date(Date.now() - 30_000);
    await prisma.device.updateMany({
      where: { status: "online", last_seen: { lt: cutoff } },
      data: { status: "offline" },
    });
  }, 15_000);

  const cleanup = () => {
    clearInterval(offlineInterval);
    io.close();
  };

  return { io, emitToDevice, emitToDeviceAck, cleanup };
};
