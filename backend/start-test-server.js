/** Start backend on port 5001 with the test database. */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is not set. Check your .env file.");
}

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.PORT = "5001";

require("./src/index");

// Mock the socket bridge so signage routes don't fail in e2e tests.
const piBridge = require("./src/services/piBridge");
piBridge.setEmitter(
  () => Promise.resolve({ ok: true, asset: { asset_id: "mock-asset" } }),
);
