/** Start backend on port 5001 with the test database. */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is not set. Check your .env file.");
}

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.PORT = "5001";

// Track piBridge emitter calls so E2E tests can verify clear_all was sent.
global._bridgeCalls = [];

const app = require("./src/app");
app.get("/api/test/bridge-calls", (_req, res) => {
  res.json(global._bridgeCalls || []);
});
app.post("/api/test/bridge-calls/clear", (_req, res) => {
  global._bridgeCalls = [];
  res.json({ ok: true });
});

require("./src/index");

// Override emitToDevice so refreshGroupDevices calls are visible to tests.
app.set("emitToDevice", (device_id, event, data) => {
  global._bridgeCalls.push({ device_id, event, data, type: "emit" });
  return true;
});

// Mock the socket bridge so signage routes don't fail in e2e tests.
const piBridge = require("./src/services/piBridge");
piBridge.setEmitter((device_id, event, data, timeout) => {
  global._bridgeCalls.push({ device_id, event, data, timeout, at: new Date().toISOString(), type: "ack" });
  return Promise.resolve({ ok: true, asset: { asset_id: "mock-asset" } });
});
