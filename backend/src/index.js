require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const initSocket = require("./websocket/socket");

const app = express();
const server = http.createServer(app); // ← http server shared with Socket.IO

app.use(cors());
app.use(express.json());
app.use(
  "/uploads",
  (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(path.join(__dirname, "../uploads")),
);

// Init Socket.IO and expose emitToDevice globally on app
const { emitToDevice } = initSocket(server);
app.set("emitToDevice", emitToDevice);

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/departments", require("./routes/departments"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/devices", require("./routes/devices"));
app.use("/api/sensors", require("./routes/sensors"));
app.use("/api/playlists", require("./routes/playlists"));
app.use("/api/signage", require("./routes/signage"));

app.get("/api/health", (_, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
