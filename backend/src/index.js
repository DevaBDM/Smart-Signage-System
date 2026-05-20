require("dotenv").config();

if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not set. Exiting.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("FATAL: DATABASE_URL is not set. Exiting.");
  process.exit(1);
}

const http = require("http");
const initSocket = require("./websocket/socket");
const app = require("./app");
const piBridge = require("./services/piBridge");
const streamRelay = require("./services/streamRelay");
const healthMonitor = require("./services/streamRelay/healthMonitor");

const server = http.createServer(app);

const { emitToDevice, emitToDeviceAck } = initSocket(server);
app.set("emitToDevice", emitToDevice);
piBridge.setEmitter(emitToDeviceAck);

// Prune orphan stream dirs, then bootstrap relays for published live posts
streamRelay.pruneOrphanDirs();
streamRelay.bootstrapAll().catch((err) => {
  console.error("[bootstrap] streamRelay bootstrap failed:", err.message);
});

// Start periodic health checks for active relays
healthMonitor.start();

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
