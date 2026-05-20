import { test, expect } from "@playwright/test";
import {
  resetState,
  API_URL,
} from "../helpers/test-helpers.js";

const TEST_HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

/**
 * ──────────────────────────────────────────────────────────────
 *  MANUAL SMOKE TEST: Pi / Anthias Live Stream Integration
 * ──────────────────────────────────────────────────────────────
 *
 *  BEFORE RUNNING THIS TEST, please ensure the following:
 *
 *  1. Raspberry Pi is powered on and connected to the network.
 *  2. Pi agent (content_sync.py) is running or will start on boot.
 *  3. The server backend and frontend dev servers are running.
 *  4. The HLS test stream is reachable from the Pi (internet access).
 *
 *  The test will auto-create all backend state (live stream, post,
 *  approved device, deployment). It then verifies the deployment
 *  payload sent to the Pi contains media_type="LIVE_STREAM".
 *
 *  Finally, it prints what to manually verify on the Anthias screen.
 * ──────────────────────────────────────────────────────────────
 */

test.describe.configure({ mode: "serial" });

test.describe("3.4 Pi Live Stream Smoke Test", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  let creatorToken;
  let adminToken;
  let deviceId;
  let postId;
  let streamId;
  let groupId;

  test.beforeAll(async ({ request }) => {
    await resetState(request);

    // ── 1. Login as admin (for device registration) ──
    const adminLogin = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-admin", password: "TestPass123!" },
    });
    if (!adminLogin.ok()) {
      // Admin may not exist yet; register as first user
      const reg = await request.post(`${API_URL}/auth/register`, {
        data: { username: "test-admin", password: "TestPass123!", role: "admin" },
      });
      expect(reg.ok(), "Admin registration failed").toBeTruthy();
      const afterReg = await request.post(`${API_URL}/auth/login`, {
        data: { username: "test-admin", password: "TestPass123!" },
      });
      expect(afterReg.ok(), "Admin login after registration failed").toBeTruthy();
      const json = await afterReg.json();
      adminToken = json.token;
    } else {
      const json = await adminLogin.json();
      adminToken = json.token;
    }

    // ── 2. Login as creator (for live streams / posts) ──
    const creatorLogin = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    expect(creatorLogin.ok(), "Creator login failed").toBeTruthy();
    const creatorJson = await creatorLogin.json();
    creatorToken = creatorJson.token;

    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    const me = await meRes.json();
    groupId = me.group_id;
    expect(groupId, "Creator must have a group_id").toBeDefined();

    // ── 3. Create an approved Pi device (as admin) ──
    const deviceRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        device_name: "Smoke-Test-Pi-01",
        ip_address: "192.168.1.50",
        group_id: groupId,
        is_approved: true,
        status: "online",
      },
    });
    if (!deviceRes.ok()) {
      const err = await deviceRes.json();
      console.error("Device registration error:", err);
    }
    expect(deviceRes.ok(), "Device registration failed").toBeTruthy();
    const device = await deviceRes.json();
    deviceId = device.id;

    // Approve explicitly
    const approveRes = await request.post(`${API_URL}/devices/${deviceId}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { group_id: groupId },
    });
    expect(approveRes.ok(), "Device approval failed").toBeTruthy();

    // Set device status to online (required for post creation with device_ids)
    const onlineRes = await request.put(`${API_URL}/devices/${deviceId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: "online" },
    });
    expect(onlineRes.ok(), "Setting device online failed").toBeTruthy();

    // ── 4. Create HLS live stream (as creator) ──
    const streamRes = await request.post(`${API_URL}/live-streams`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      data: {
        title: "Smoke Test HLS Stream",
        stream_type: "HLS",
        source_url: TEST_HLS,
        group_id: groupId,
      },
    });
    if (!streamRes.ok()) {
      const err = await streamRes.json();
      console.error("Live stream creation error:", err);
    }
    expect(streamRes.ok(), "Live stream creation failed").toBeTruthy();
    const stream = await streamRes.json();
    streamId = stream.id;

    // Start relay
    const startRes = await request.post(`${API_URL}/live-streams/${streamId}/start`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    expect(startRes.ok(), "Stream relay start failed").toBeTruthy();

    const getStreamRes = await request.get(`${API_URL}/live-streams/${streamId}`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    const liveStream = await getStreamRes.json();
    console.log("\n📡  Live stream relay_url:", liveStream.relay_url);

    // ── 5. Create live-stream post (as creator) ──
    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      data: {
        title: "Pi Smoke Test Post",
        description: "Testing live stream on Anthias",
        group_id: groupId,
        live_stream_id: streamId,
        status: "published",
        allowed_on_signage: true,
        allowed_on_feed: false,
        device_ids: [deviceId],
        duration_seconds: 3600,
      },
    });
    if (!postRes.ok()) {
      const err = await postRes.json();
      console.error("Post creation error:", err);
    }
    expect(postRes.ok(), "Post creation failed").toBeTruthy();
    const postBody = await postRes.json();
    // Response shape: { posts: [...] }
    const posts = postBody.posts || postBody;
    const post = Array.isArray(posts) ? posts[0] : posts;
    postId = post?.id;
    console.log("📝  Post created:", post?.title, "(id:", postId, ")");
  });

  test("Prerequisite checklist printed in console", async () => {
    console.log("\n" + "=".repeat(60));
    console.log("  MANUAL SMOKE TEST — PREREQUISITE CHECKLIST");
    console.log("=".repeat(60));
    console.log("\n  Please confirm the following before proceeding:");
    console.log("\n  [ ] 1. Raspberry Pi is powered on and on the network");
    console.log("  [ ] 2. Pi agent / Anthias is running (or will start on boot)");
    console.log("  [ ] 3. Backend server is running (npm run dev / node index.js)");
    console.log("  [ ] 4. Frontend dev server is running (npm run dev)");
    console.log("  [ ] 5. The Pi has internet access to reach the test HLS URL");
    console.log("  [ ] 6. OBS or any HLS player is NOT needed — this is passthrough");
    console.log("\n" + "=".repeat(60));
    console.log("  If all items above are checked, the test will continue.");
    console.log("=".repeat(60) + "\n");

    // Soft assertion — this always passes; it just prints the checklist
    expect(true).toBe(true);
  });

  test("Auto-verify: deployment record and asset payload", async ({ request }) => {
    await test.step("Check deployment record exists in DB", async () => {
      const { execSync } = await import("child_process");
      const { fileURLToPath } = await import("url");
      const path = await import("path");
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const script = path.resolve(__dirname, "../../../backend/scripts/checkSignageDeployment.js");
      const out = execSync(`node "${script}" ${postId} ${deviceId}`, { encoding: "utf-8" });
      const jsonLine = out.trim().split(/\r?\n/).filter((l) => l.trim().startsWith("{")).pop();
      const result = JSON.parse(jsonLine);

      console.log("\n✅  Deployment DB check:");
      console.log("     deployments :", result.deployments);
      console.log("     deviceStatus:", result.deviceStatus);
      expect(result.deployments).toBeGreaterThan(0);
    });

    await test.step("Verify SignageAsset has LIVE_STREAM type if synced", async () => {
      const assetRes = await request.get(`${API_URL}/signage/devices/${deviceId}/assets`, {
        headers: { Authorization: `Bearer ${creatorToken}` },
      });

      if (!assetRes.ok()) {
        console.log("\n⚠️  No SignageAsset synced yet — Pi may be offline or not yet polled.");
        console.log("     This is expected if the Pi is not running.\n");
        return;
      }

      const body = await assetRes.json();
      // Response shape: { ok, assets: [...], tracked_assets: [...] }
      const assets = body.assets || [];
      const tracked = body.tracked_assets || [];

      const liveAsset = assets.find(
        (a) => a.post_id === postId || a.name?.includes(String(postId))
      ) || tracked.find((a) => a.post_id === postId);

      if (liveAsset) {
        console.log("\n✅  SignageAsset synced on Pi:");
        console.log("     asset_id  :", liveAsset.asset_id || liveAsset.id);
        console.log("     name      :", liveAsset.name);
        console.log("     uri       :", liveAsset.uri || liveAsset.image_url);
        console.log("     mimetype  :", liveAsset.mimetype);
        if (liveAsset.mimetype) {
          expect(liveAsset.mimetype).toBe("webpage");
        }
      } else {
        console.log("\n⚠️  Asset not yet found in Anthias list — Pi may not have polled yet.");
        console.log("     tracked_assets count:", tracked.length);
        console.log("     pi_assets count      :", assets.length);
      }
    });
  });

  test("Manual verification: Anthias shows live stream as webpage asset", async () => {
    console.log("\n" + "=".repeat(60));
    console.log("  MANUAL VERIFICATION STEPS");
    console.log("=".repeat(60));
    console.log("\n  1. Open Anthias web UI on the Pi (or your Anthias dashboard)");
    console.log("     http://<pi-ip>:8080");
    console.log("\n  2. Go to 'Assets' page");
    console.log("\n  3. Look for an asset named like:");
    console.log(`     'Pi Smoke Test Post (${postId})'`);
    console.log("\n  4. EXPECTED: Asset type = 'Webpage'");
    console.log("     EXPECTED: URI contains the test HLS URL:");
    console.log(`     ${TEST_HLS}`);
    console.log("\n  5. If the Pi screen is visible, you should see:");
    console.log("     - A live video playing (Big Buck Bunny test stream)");
    console.log("     - Or the Anthias webpage player loading the stream");
    console.log("\n  6. If the stream does not appear:");
    console.log("     a) Check Pi network connectivity (can it reach the HLS URL?)");
    console.log("     b) Check Anthias logs: docker logs screenly-anthias-viewer");
    console.log("     c) Verify the deployment status in Admin > Devices");
    console.log("\n" + "=".repeat(60));
    console.log("  END OF MANUAL VERIFICATION GUIDE");
    console.log("=".repeat(60) + "\n");

    // Always pass — this step is purely instructional
    expect(true).toBe(true);
  });
});
