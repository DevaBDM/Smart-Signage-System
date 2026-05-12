const router = require("express").Router();
const pool = require("../db/pool");

router.post("/log", async (req, res) => {
  const { device_id, sensor_type, value } = req.body;
  await pool.query(
    "INSERT INTO sensor_logs (device_id, sensor_type, value) VALUES ($1,$2,$3)",
    [device_id, sensor_type, value],
  );
  res.json({ ok: true });
});

router.get("/:device_id", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM sensor_logs WHERE device_id=$1 ORDER BY logged_at DESC LIMIT 50",
    [req.params.device_id],
  );
  res.json(result.rows);
});

module.exports = router;
