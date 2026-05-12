const router = require("express").Router();
const pool = require("../db/pool");
const auth = require("../middleware/auth");

// Raspberry Pi sends heartbeat to register/update itself
router.post("/heartbeat", async (req, res) => {
  const { name, ip_address, location } = req.body;
  await pool.query(
    `INSERT INTO devices (name, ip_address, location, status, last_seen)
     VALUES ($1, $2, $3, 'online', NOW())
     ON CONFLICT (ip_address) DO UPDATE
     SET status='online', last_seen=NOW()`,
    [name, ip_address, location],
  );
  res.json({ ok: true });
});

// Get all devices
router.get("/", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM devices ORDER BY last_seen DESC",
  );
  res.json(result.rows);
});

module.exports = router;
