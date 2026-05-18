const router = require("express").Router();
const auth = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const { listUsers, updateUser, removeUser } = require("../services/userService");

router.get("/", auth(["admin"]), async (req, res) => {
  res.json(await listUsers());
});

router.put("/:id", auth(["admin"]), asyncHandler(async (req, res) => {
  const updated = await updateUser(Number(req.params.id), req.body);
  res.json(updated);
}));

router.delete("/:id", auth(["admin"]), asyncHandler(async (req, res) => {
  const result = await removeUser(Number(req.params.id), req.user.id);
  res.json(result);
}));

module.exports = router;
