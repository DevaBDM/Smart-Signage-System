const prisma = require("../db/prisma");

/**
 * Middleware to authenticate Pi devices via a per-device token.
 * Expects Authorization: Bearer <device_token> header.
 * Sets req.device with the verified device record.
 */
module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  console.log(`[authDevice] ${req.method} ${req.path} — token present: ${!!token}`);

  if (!token) {
    return res.status(401).json({ error: "Access denied. No device token provided." });
  }

  try {
    const device = await prisma.device.findFirst({
      where: { device_token: token },
    });

    if (!device) {
      console.warn(`[authDevice] No device found for token (first 8 chars): ${token.slice(0, 8)}...`);
      return res.status(401).json({ error: "Invalid device token." });
    }

    console.log(`[authDevice] Authenticated device ${device.id} (${device.device_name})`);
    req.device = device;
    next();
  } catch (err) {
    console.error(`[authDevice] DB error: ${err.message}`);
    res.status(500).json({ error: "Device authentication failed." });
  }
};
