const router = require("express").Router();
const auth = require("../middleware/auth");
const { listUsers, updateUser, removeUser } = require("../services/userService");

router.get("/", auth(["admin"]), async (req, res) => {
  res.json(await listUsers());
});

router.put("/:id", auth(["admin"]), async (req, res) => {
  try {
    const updated = await updateUser(Number(req.params.id), req.body);
    res.json(updated);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

router.delete("/:id", auth(["admin"]), async (req, res) => {
  try {
    const result = await removeUser(Number(req.params.id), req.user.id);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

module.exports = router;
