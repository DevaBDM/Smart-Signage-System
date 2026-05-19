import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = "http://localhost:5001/api";

/** Login with the test admin account. Creates it via first-user registration if needed. */
async function loginTestAdmin(request) {
  const username = "test-admin";
  const password = "TestPass123!";

  // Try login first (account may already exist)
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { username, password },
  });
  if (login.ok()) {
    const json = await login.json();
    expect(json.token, "Login response should contain token").toBeDefined();
    return json.token;
  }

  // Login failed — try first-user registration (works when DB is empty)
  const reg = await request.post(`${API_URL}/auth/register`, {
    data: { username, password, role: "admin" },
  });
  expect(reg.ok(), "First-user registration should succeed").toBeTruthy();

  // Registration succeeded — login to get token
  const afterReg = await request.post(`${API_URL}/auth/login`, {
    data: { username, password },
  });
  expect(afterReg.ok(), "Login after registration should succeed").toBeTruthy();
  const json = await afterReg.json();
  expect(json.token, "Login response should contain token").toBeDefined();
  return json.token;
}

async function resetState(request) {
  const res = await request.post(`${API_URL}/test/reset`);
  expect(res.ok(), "Reset endpoint should succeed").toBeTruthy();
}

test.describe.configure({ mode: "serial" });

test.describe("happy path smoke tests", () => {
  let token;

  test.beforeEach(async ({ request }) => {
    await resetState(request);
    token = await loginTestAdmin(request);
  });

  test("create a post via API", async ({ request }) => {
    // Seed a group
    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `TestGroup-${Date.now()}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    const group = await groupRes.json();

    // Create post (backend expects multipart/form-data)
    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        title: "Smoke Test Post",
        group_ids: JSON.stringify([group.id]),
        status: "published",
        allowed_on_signage: "true",
      },
    });
    expect(postRes.ok()).toBeTruthy();
    const postData = await postRes.json();
    expect(postData.posts).toBeInstanceOf(Array);
    expect(postData.posts[0].title).toBe("Smoke Test Post");
    expect(postData.count).toBe(1);
  });

  test("publish to signage and approve device", async ({ request }) => {
    // Create group
    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `SignageGroup-${Date.now()}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    const group = await groupRes.json();

    // Minimal 1x1 white PNG (base64)
    const miniPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );

    // Create post with an uploaded image (backend expects multipart)
    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        title: "Signage Post",
        group_ids: JSON.stringify([group.id]),
        status: "published",
        allowed_on_signage: "true",
        images: {
          name: "test.png",
          mimeType: "image/png",
          buffer: miniPng,
        },
      },
    });
    expect(postRes.ok()).toBeTruthy();
    const postData = await postRes.json();
    const postId = postData.posts[0].id;

    // Register a device manually
    const deviceRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        device_name: "Smoke Pi",
        ip_address: "192.168.1.99",
        group_id: group.id,
      },
    });
    expect(deviceRes.ok()).toBeTruthy();
    const device = await deviceRes.json();

    // Set device online so publish is allowed
    const statusRes = await request.put(`${API_URL}/devices/${device.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: "online" },
    });
    expect(statusRes.ok()).toBeTruthy();

    // Publish post to signage via API
    const publishRes = await request.post(`${API_URL}/signage/publish`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        post_id: postId,
        device_id: device.id,
        duration_seconds: 10,
      },
    });
    expect(publishRes.ok()).toBeTruthy();
    const pubBody = await publishRes.json();
    expect(pubBody.ok).toBe(true);
  });
});

test.describe("UI smoke tests", () => {
  test.beforeEach(async ({ request }) => {
    await resetState(request);
  });

  test("login via frontend form succeeds", async ({ page }) => {
    const username = "test-admin";
    const password = "TestPass123!";

    // Navigate to login page
    await page.goto("/login");
    await expect(page.locator('h1:has-text("Smart Signage")')).toBeVisible();

    // Fill form and submit
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Exact redirect to admin dashboard
    await page.waitForURL("**/admin", { timeout: 5000 });

    // Verify no error message is visible
    await expect(page.locator("text=Invalid username or password.")).not.toBeVisible();

    // Verify all auth fields persisted in localStorage
    const auth = await page.evaluate(() => ({
      token: localStorage.getItem("token"),
      role: localStorage.getItem("role"),
      max_signage_state: localStorage.getItem("max_signage_state"),
      managed_group_ids: localStorage.getItem("managed_group_ids"),
    }));
    expect(auth.token).toBeTruthy();
    expect(auth.role).toBe("admin");
    expect(auth.max_signage_state).toBe("NORMAL");
    expect(auth.managed_group_ids).toBe("[]");

    // Verify admin dashboard is rendered
    await expect(page.locator('h1:has-text("Admin Dashboard")')).toBeVisible();

    // Authenticated users visiting /login should be redirected to /admin
    await page.goto("/login");
    await page.waitForURL("**/admin", { timeout: 5000 });
  });

  test("create multiple groups with different scenarios", async ({ page, request }) => {
    const ts = Date.now();

    // Login first
    await page.goto("/login");
    await page.fill('input[name="username"]', "test-admin");
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin", { timeout: 5000 });

    // Navigate to Groups page and wait for data to load
    await page.goto("/admin/groups");
    await expect(page.locator('h1:has-text("Groups")')).toBeVisible();
    await page.waitForLoadState("networkidle");

    // Record baseline row count (happy-path tests may have created groups)
    const rows = page.locator('table tbody tr');
    const baselineCount = await rows.count();

    // Helper: get form input values
    const getFormValues = async () =>
      page.evaluate(() => ({
        name: document.querySelector('input[required]')?.value || "",
        description: document.querySelector('textarea')?.value || "",
      }));

    // Scenario 1: Basic group with NORMAL state (default)
    await page.fill('label:has-text("Name") + input, input[required]:near(label:text("Name"))', `Normal-Group-${ts}`);
    await page.fill('label:has-text("Description") + textarea', "A normal group for everyday content");
    await page.click('button:has-text("Create")');
    await expect(page.locator(`text=Normal-Group-${ts}`)).toBeVisible();
    // Form should reset after successful creation
    const formAfterCreate1 = await getFormValues();
    expect(formAfterCreate1.name).toBe("");

    // Scenario 2: Emergency group with EMERGENCY state
    await page.fill('label:has-text("Name") + input, input[required]:near(label:text("Name"))', `Emergency-Group-${ts}`);
    await page.fill('label:has-text("Description") + textarea', "Critical alerts and emergency broadcasts");
    await page.selectOption('label:has-text("Display mode") + select, select:near(label:text("Display mode"))', "EMERGENCY");
    await page.click('button:has-text("Create")');
    await expect(page.locator(`text=Emergency-Group-${ts}`)).toBeVisible();

    // Scenario 3: Security group with SECURITY_RISK state, no description
    await page.fill('label:has-text("Name") + input, input[required]:near(label:text("Name"))', `Security-Group-${ts}`);
    await page.fill('label:has-text("Description") + textarea', "");
    await page.selectOption('label:has-text("Display mode") + select, select:near(label:text("Display mode"))', "SECURITY_RISK");
    await page.click('button:has-text("Create")');
    await expect(page.locator(`text=Security-Group-${ts}`)).toBeVisible();

    // Scenario 4: Breaking news group with BREAKING_NEWS state
    await page.fill('label:has-text("Name") + input, input[required]:near(label:text("Name"))', `Breaking-Group-${ts}`);
    await page.fill('label:has-text("Description") + textarea', "Live updates and breaking news");
    await page.selectOption('label:has-text("Display mode") + select, select:near(label:text("Display mode"))', "BREAKING_NEWS");
    await page.click('button:has-text("Create")');
    await expect(page.locator(`text=Breaking-Group-${ts}`)).toBeVisible();

    // Verify all 4 newly created groups appear with correct display modes
    await expect(page.locator(`tr:has-text("Normal-Group-${ts}"):has-text("Normal")`)).toBeVisible();
    await expect(page.locator(`tr:has-text("Emergency-Group-${ts}"):has-text("Emergency")`)).toBeVisible();
    await expect(page.locator(`tr:has-text("Security-Group-${ts}"):has-text("Security & Risk")`)).toBeVisible();
    await expect(page.locator(`tr:has-text("Breaking-Group-${ts}"):has-text("Breaking News")`)).toBeVisible();

    // Verify descriptions rendered correctly
    await expect(page.locator(`tr:has-text("Normal-Group-${ts}"):has-text("A normal group for everyday content")`)).toBeVisible();
    await expect(page.locator(`tr:has-text("Emergency-Group-${ts}"):has-text("Critical alerts and emergency broadcasts")`)).toBeVisible();
    // Empty description should show "No description" fallback
    await expect(page.locator(`tr:has-text("Security-Group-${ts}"):has-text("No description")`)).toBeVisible();

    // Scenario 5: Duplicate name should be rejected (form stays filled, row count unchanged)
    await page.fill('label:has-text("Name") + input, input[required]:near(label:text("Name"))', `Normal-Group-${ts}`);
    await page.fill('label:has-text("Description") + textarea', "Duplicate attempt");
    await page.click('button:has-text("Create")');
    // Form should still have the duplicate name (create failed silently in UI)
    const formAfterDup = await getFormValues();
    expect(formAfterDup.name).toBe(`Normal-Group-${ts}`);
    // Row count should not increase
    const dupCount = await rows.count();
    expect(dupCount).toBe(baselineCount + 4);
    // Verify backend also rejects it via API
    const token = await page.evaluate(() => localStorage.getItem("token"));
    const dupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `Normal-Group-${ts}`, description: "API dup" },
    });
    expect(dupRes.status()).toBe(400);
    const dupBody = await dupRes.json();
    expect(dupBody.error).toBe("Group name already exists.");

    // Scenario 6: Update a group's display mode from NORMAL to EMERGENCY
    const normalRow = page.locator(`tr:has-text("Normal-Group-${ts}")`);
    const stateSelect = normalRow.locator('select');
    await stateSelect.selectOption("EMERGENCY");
    await expect(page.locator(`tr:has-text("Normal-Group-${ts}"):has-text("Emergency")`)).toBeVisible();

    // Scenario 7: Delete a group
    const securityRow = page.locator(`tr:has-text("Security-Group-${ts}")`);
    page.on('dialog', async (dialog) => await dialog.accept());
    await securityRow.locator('button:has-text("Delete")').click();
    await expect(securityRow).not.toBeVisible();

    // Verify remaining groups via API
    const finalRes = await request.get(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(finalRes.ok()).toBeTruthy();
    const groups = await finalRes.json();
    expect(groups).toHaveLength(baselineCount + 3);
    const names = groups.map((g) => g.name).sort();
    expect(names).toContain(`Breaking-Group-${ts}`);
    expect(names).toContain(`Emergency-Group-${ts}`);
    expect(names).toContain(`Normal-Group-${ts}`);
    expect(names).not.toContain(`Security-Group-${ts}`);
  });

  test("manage posts from admin dashboard", async ({ page, request }) => {
    const ts = Date.now();

    // Login via UI
    await page.goto("/login");
    await page.fill('input[name="username"]', "test-admin");
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin", { timeout: 5000 });

    // Get token for API seeding
    const token = await page.evaluate(() => localStorage.getItem("token"));

    // Seed a group and a post via API
    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `PostTestGroup-${ts}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    const group = await groupRes.json();

    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        title: `Dashboard Post ${ts}`,
        group_ids: JSON.stringify([group.id]),
        status: "published",
        allowed_on_feed: "false",
        allowed_on_signage: "false",
      },
    });
    expect(postRes.ok()).toBeTruthy();
    const postData = await postRes.json();
    const postId = postData.posts[0].id;

    // Navigate to Posts page
    await page.goto("/admin/posts");
    await expect(page.locator('h1:has-text("All Posts")')).toBeVisible();
    await page.waitForLoadState("networkidle");

    // Verify the post row is present
    const postRow = page.locator(`tr:has-text("Dashboard Post ${ts}")`);
    await expect(postRow).toBeVisible();
    // Status badge should show "published"
    await expect(postRow.locator('text=published')).toBeVisible();
    // Feed should be ⬜ (not allowed)
    await expect(postRow.locator('td').nth(3).locator('text=⬜')).toBeVisible();
    // Signage should be ⬜ (not allowed)
    await expect(postRow.locator('td').nth(4).locator('text=⬜')).toBeVisible();

    // Toggle allowed_on_feed — click the feed cell
    const feedCell = postRow.locator('td').nth(3);
    await feedCell.click();
    await expect(feedCell.locator('text=✅')).toBeVisible();

    // Toggle allowed_on_signage — click the signage cell
    const signageCell = postRow.locator('td').nth(4);
    await signageCell.click();
    await expect(signageCell.locator('text=✅')).toBeVisible();

    // Verify toggles persisted via API
    const getRes = await request.get(`${API_URL}/posts/${postId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.ok()).toBeTruthy();
    const apiPost = await getRes.json();
    expect(apiPost.allowed_on_feed).toBe(true);
    expect(apiPost.allowed_on_signage).toBe(true);

    // Delete the post via UI
    page.on('dialog', async (dialog) => await dialog.accept());
    await postRow.locator('button:has-text("Delete")').click();
    await expect(postRow).not.toBeVisible();

    // Verify deletion via API
    const listRes = await request.get(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const posts = await listRes.json();
    expect(posts.some((p) => p.id === postId)).toBe(false);
  });
});

test.describe("Device lifecycle API tests", () => {
  let adminToken;
  let creatorToken;
  let group;
  let deviceId;

  test.beforeEach(async ({ request }) => {
    await resetState(request);
    adminToken = await loginTestAdmin(request);

    // Login as test-creator
    const creatorLogin = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    expect(creatorLogin.ok()).toBeTruthy();
    const creatorData = await creatorLogin.json();
    creatorToken = creatorData.token;

    // Create a group for device tests
    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `DeviceTestGroup-${Date.now()}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    group = await groupRes.json();
  });

  test("1. Approval flow — pending device becomes active", async ({ request }) => {
    // Seed a pending device via backend script (simulates agent heartbeat)
    const script = path.resolve(__dirname, "../../backend/scripts/createPendingDevice.js");
    const out = execSync(`node "${script}" ${group.id}`, { encoding: "utf-8" });
    // Filter out dotenvx injection logs and take the last JSON line
    const jsonLine = out.trim().split(/\r?\n/).filter((l) => l.trim().startsWith("{")).pop();
    const { id } = JSON.parse(jsonLine);
    deviceId = id;

    // Verify the device is pending
    const getRes = await request.get(`${API_URL}/devices/${deviceId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.ok()).toBeTruthy();
    const before = await getRes.json();
    expect(before.is_approved).toBe(false);
    expect(before.pending_name).toBe("Lab-Pi-01");
    expect(before.pending_ip).toBe("192.168.1.50");

    // Approve the device
    const approveRes = await request.post(`${API_URL}/devices/${deviceId}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { group_id: group.id },
    });
    expect(approveRes.ok()).toBeTruthy();
    const after = await approveRes.json();
    expect(after.is_approved).toBe(true);
    expect(after.device_name).toBe("Lab-Pi-01");
    expect(after.pending_name).toBeNull();
    expect(after.pending_ip).toBeNull();
  });

  test("2. Configuration flow — edit metadata", async ({ request }) => {
    // Register and approve a fresh device
    const regRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { device_name: "Config Pi", ip_address: "192.168.1.11", group_id: group.id },
    });
    expect(regRes.ok()).toBeTruthy();
    const dev = await regRes.json();

    await request.post(`${API_URL}/devices/${dev.id}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { group_id: group.id },
    });

    const updateRes = await request.put(`${API_URL}/devices/${dev.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { location: "Science Wing, Room 302", all_groups: true },
    });
    expect(updateRes.ok()).toBeTruthy();
    const updated = await updateRes.json();
    expect(updated.location).toBe("Science Wing, Room 302");
    expect(updated.all_groups).toBe(true);

    // Verify DB reflects changes via GET
    const getRes = await request.get(`${API_URL}/devices/${dev.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.ok()).toBeTruthy();
    const device = await getRes.json();
    expect(device.location).toBe("Science Wing, Room 302");
    expect(device.all_groups).toBe(true);
  });

  test("3. Cleanup flow — secure deletion with clear_all", async ({ request }) => {
    // Register, approve and set a device online
    const regRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { device_name: "Cleanup Pi", ip_address: "192.168.1.12", group_id: group.id },
    });
    expect(regRes.ok()).toBeTruthy();
    const dev = await regRes.json();

    await request.post(`${API_URL}/devices/${dev.id}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { group_id: group.id },
    });

    const statusRes = await request.put(`${API_URL}/devices/${dev.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: "online" },
    });
    expect(statusRes.ok()).toBeTruthy();

    // Delete the device
    const deleteRes = await request.delete(`${API_URL}/devices/${dev.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(deleteRes.ok()).toBeTruthy();
    const delBody = await deleteRes.json();
    expect(delBody.ok).toBe(true);

    // Verify the socket bridge received a clear_all command for this device
    const bridgeRes = await request.get(`${API_URL}/test/bridge-calls`);
    expect(bridgeRes.ok()).toBeTruthy();
    const calls = await bridgeRes.json();
    const clearAllCall = calls.find(
      (c) =>
        c.device_id === dev.id &&
        c.event === "signage_command" &&
        c.data?.action === "clear_all",
    );
    expect(clearAllCall, "clear_all command should have been emitted to the device").toBeDefined();

    // Verify the device no longer exists in the DB
    const getRes = await request.get(`${API_URL}/devices/${dev.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.status()).toBe(404);
  });

  test("4. Security flow — RBAC enforcement", async ({ request }) => {
    // Seed another pending device for the RBAC test
    const script = path.resolve(__dirname, "../../backend/scripts/createPendingDevice.js");
    const out = execSync(`node "${script}" ${group.id}`, { encoding: "utf-8" });
    const jsonLine = out.trim().split(/\r?\n/).filter((l) => l.trim().startsWith("{")).pop();
    const { id: rbacDeviceId } = JSON.parse(jsonLine);

    // Creator tries to approve → 403 Forbidden
    const approveRes = await request.post(`${API_URL}/devices/${rbacDeviceId}/approve`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      data: { group_id: group.id },
    });
    expect(approveRes.status()).toBe(403);

    // Creator tries to delete → 403 Forbidden
    const deleteRes = await request.delete(`${API_URL}/devices/${rbacDeviceId}`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    expect(deleteRes.status()).toBe(403);
  });

  test("5. Reset flow — factory reset simulation", async ({ request }) => {
    // Register an approved device with custom fields
    const regRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        device_name: "Custom Pi",
        ip_address: "192.168.1.100",
        location: "Library",
        group_id: group.id,
      },
    });
    expect(regRes.ok()).toBeTruthy();
    const device = await regRes.json();

    // Reset it
    const resetRes = await request.put(`${API_URL}/devices/${device.id}/reset`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(resetRes.ok()).toBeTruthy();
    const resetBody = await resetRes.json();
    expect(resetBody.device.device_name).toBe(`Pi Display ${device.id}`);
    expect(resetBody.device.location).toBeNull();
    expect(resetBody.device.ip_address).toBe("");
  });

  test("6. Device logs — sensor logs are created and retrievable", async ({ request }) => {
    // Register a device
    const regRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        device_name: "Log Test Pi",
        ip_address: "192.168.1.55",
        group_id: group.id,
      },
    });
    expect(regRes.ok()).toBeTruthy();
    const device = await regRes.json();

    // Create a sensor log via the device REST endpoint
    const logRes = await request.post(`${API_URL}/sensors/log`, {
      data: {
        device_id: device.id,
        motion: true,
        brightness: 75,
        rain: false,
      },
    });
    expect(logRes.ok()).toBeTruthy();
    const logBody = await logRes.json();
    expect(logBody.device_id).toBe(device.id);
    expect(logBody.motion).toBe(true);
    expect(logBody.brightness).toBe(75);
    expect(logBody.rain).toBe(false);

    // Verify the log appears via GET /devices/:id (includes sensor_logs)
    const getRes = await request.get(`${API_URL}/devices/${device.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.ok()).toBeTruthy();
    const fullDevice = await getRes.json();
    expect(fullDevice.sensor_logs).toBeInstanceOf(Array);
    expect(fullDevice.sensor_logs.length).toBeGreaterThan(0);
    const found = fullDevice.sensor_logs.find(
      (l) => l.motion === true && l.brightness === 75 && l.rain === false,
    );
    expect(found, "sensor log should be embedded in device response").toBeDefined();

    // Verify via the sensors endpoint
    const sensorRes = await request.get(`${API_URL}/sensors/${device.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(sensorRes.ok()).toBeTruthy();
    const sensorLogs = await sensorRes.json();
    expect(sensorLogs).toBeInstanceOf(Array);
    expect(sensorLogs.length).toBeGreaterThan(0);
  });
});

test.describe("Group API hardening tests", () => {
  let adminToken;

  test.beforeEach(async ({ request }) => {
    await resetState(request);
    adminToken = await loginTestAdmin(request);
  });

  test("Device refresh side-effect when signage_state changes", async ({ request }) => {
    // Create a group
    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `RefreshGroup-${Date.now()}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    const grp = await groupRes.json();

    // Register and approve a device in the group, mark it online
    const regRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        device_name: "Refresh Pi",
        ip_address: "192.168.1.200",
        group_id: grp.id,
      },
    });
    expect(regRes.ok()).toBeTruthy();
    const dev = await regRes.json();

    await request.post(`${API_URL}/devices/${dev.id}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { group_id: grp.id },
    });

    await request.put(`${API_URL}/devices/${dev.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: "online" },
    });

    // Change group signage_state → should trigger refresh_display
    const updateRes = await request.put(`${API_URL}/groups/${grp.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { signage_state: "EMERGENCY" },
    });
    expect(updateRes.ok()).toBeTruthy();

    // Verify the bridge received a refresh_display command for this device
    const bridgeRes = await request.get(`${API_URL}/test/bridge-calls`);
    expect(bridgeRes.ok()).toBeTruthy();
    const calls = await bridgeRes.json();
    const refreshCall = calls.find(
      (c) =>
        c.type === "emit" &&
        c.device_id === dev.id &&
        c.event === "refresh_display" &&
        c.data?.reason === "group_signage_state",
    );
    expect(refreshCall, "refresh_display should have been emitted after group state change").toBeDefined();
  });

  test("Managed groups visibility — creator only sees assigned groups", async ({ request }) => {
    const ts = Date.now();

    // Create three groups
    const aRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `Group-A-${ts}` },
    });
    expect(aRes.ok()).toBeTruthy();
    const groupA = await aRes.json();

    const bRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `Group-B-${ts}` },
    });
    expect(bRes.ok()).toBeTruthy();
    const groupB = await bRes.json();

    const cRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `Group-C-${ts}` },
    });
    expect(cRes.ok()).toBeTruthy();
    const groupC = await cRes.json();

    // Register a creator assigned only to Group A and B
    const regRes = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        username: `creator-visibility-${ts}`,
        password: "TestPass123!",
        role: "creator",
        managed_group_ids: JSON.stringify([groupA.id, groupB.id]),
      },
    });
    expect(regRes.ok()).toBeTruthy();

    // Login as the new creator
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: `creator-visibility-${ts}`, password: "TestPass123!" },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    const creatorToken = loginData.token;

    // GET /groups as creator
    const listRes = await request.get(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const groups = await listRes.json();
    const names = groups.map((g) => g.name);

    expect(groups).toHaveLength(2);
    expect(names).toContain(`Group-A-${ts}`);
    expect(names).toContain(`Group-B-${ts}`);
    expect(names).not.toContain(`Group-C-${ts}`);
  });

  test("Delete protection — cannot delete a group that has an active post", async ({ request }) => {
    const ts = Date.now();

    // Create a group
    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `ProtectedGroup-${ts}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    const grp = await groupRes.json();

    // Create a post inside the group
    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      multipart: {
        title: "Protected Post",
        group_ids: JSON.stringify([grp.id]),
        status: "published",
        allowed_on_signage: "true",
      },
    });
    expect(postRes.ok()).toBeTruthy();

    // Attempt to delete the group
    const delRes = await request.delete(`${API_URL}/groups/${grp.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(delRes.status()).toBe(400);
    const body = await delRes.json();
    expect(body.error).toMatch(/still used/i);

    // Verify the group still exists
    const listRes = await request.get(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const groups = await listRes.json();
    expect(groups.some((g) => g.id === grp.id)).toBe(true);
  });
});

test.describe("User lifecycle API tests", () => {
  let adminToken;
  let creatorToken;
  let groupA;
  let groupB;

  test.beforeEach(async ({ request }) => {
    await resetState(request);
    adminToken = await loginTestAdmin(request);

    // Login as test-creator
    const creatorLogin = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    expect(creatorLogin.ok()).toBeTruthy();
    const creatorData = await creatorLogin.json();
    creatorToken = creatorData.token;

    // Seed two groups for managed_group_ids tests
    const aRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `UserTestGroup-A-${Date.now()}` },
    });
    expect(aRes.ok()).toBeTruthy();
    groupA = await aRes.json();

    const bRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `UserTestGroup-B-${Date.now()}` },
    });
    expect(bRes.ok()).toBeTruthy();
    groupB = await bRes.json();
  });

  test("1. Admin can create a user and assign managed groups", async ({ request }) => {
    const ts = Date.now();
    const regRes = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        username: `new-creator-${ts}`,
        password: "TestPass123!",
        role: "creator",
        managed_group_ids: JSON.stringify([groupA.id, groupB.id]),
        auto_approve: false,
        can_manage_other_posts: true,
        control_lock_minutes: 60,
        max_signage_state: "EMERGENCY",
      },
    });
    expect(regRes.ok()).toBeTruthy();
    const payload = await regRes.json();
    expect(payload.username).toBe(`new-creator-${ts}`);
    expect(payload.role).toBe("creator");
    expect(payload.managed_group_ids).toContain(groupA.id);
    expect(payload.managed_group_ids).toContain(groupB.id);
    expect(payload.auto_approve).toBe(false);
    expect(payload.can_manage_other_posts).toBe(true);
    expect(payload.control_lock_minutes).toBe(60);
    expect(payload.max_signage_state).toBe("EMERGENCY");

    // Verify the new user appears in the admin users list
    const listRes = await request.get(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const users = await listRes.json();
    const found = users.find((u) => u.username === `new-creator-${ts}`);
    expect(found).toBeDefined();
    expect(found.role).toBe("creator");
    expect(found.managed_groups.map((g) => g.group_id)).toContain(groupA.id);
    expect(found.managed_groups.map((g) => g.group_id)).toContain(groupB.id);

    // Verify the new user can log in
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: `new-creator-${ts}`, password: "TestPass123!" },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    expect(loginData.token).toBeDefined();
    expect(loginData.role).toBe("creator");
  });

  test("2. Admin can update a user's role, managed groups and settings", async ({ request }) => {
    const ts = Date.now();
    // Create a user first
    const regRes = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        username: `update-target-${ts}`,
        password: "TestPass123!",
        role: "creator",
        managed_group_ids: JSON.stringify([groupA.id]),
        auto_approve: true,
      },
    });
    expect(regRes.ok()).toBeTruthy();
    const created = await regRes.json();

    // Update the user
    const updateRes = await request.put(`${API_URL}/users/${created.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        role: "viewer",
        managed_group_ids: JSON.stringify([groupB.id]),
        auto_approve: false,
        can_manage_other_posts: false,
        control_lock_minutes: 30,
        max_signage_state: "NORMAL",
      },
    });
    expect(updateRes.ok()).toBeTruthy();
    const updated = await updateRes.json();
    expect(updated.role).toBe("viewer");
    expect(updated.managed_groups.map((g) => g.group_id)).toContain(groupB.id);
    expect(updated.managed_groups.map((g) => g.group_id)).not.toContain(groupA.id);
    expect(updated.auto_approve).toBe(false);
    expect(updated.can_manage_other_posts).toBe(false);
    expect(updated.control_lock_minutes).toBe(30);
    expect(updated.max_signage_state).toBe("NORMAL");
  });

  test("3. RBAC enforcement — creator cannot access user management", async ({ request }) => {
    const ts = Date.now();
    // Creator tries GET /users
    const listRes = await request.get(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    expect(listRes.status()).toBe(403);

    // Create a sacrificial user to test PUT /users/:id and DELETE /users/:id
    const regRes = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `rbac-target-${ts}`, password: "TestPass123!", role: "viewer" },
    });
    expect(regRes.ok()).toBeTruthy();
    const target = await regRes.json();

    // Creator tries PUT /users/:id
    const putRes = await request.put(`${API_URL}/users/${target.id}`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      data: { role: "admin" },
    });
    expect(putRes.status()).toBe(403);

    // Creator tries DELETE /users/:id
    const delRes = await request.delete(`${API_URL}/users/${target.id}`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    expect(delRes.status()).toBe(403);

    // Creator tries POST /auth/register (after first user, admin-only)
    const reg2 = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      data: { username: `rbac-new-${ts}`, password: "TestPass123!", role: "creator" },
    });
    expect(reg2.status()).toBe(403);
  });

  test("4. Admin cannot delete their own account", async ({ request }) => {
    // Find the test-admin user
    const listRes = await request.get(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const users = await listRes.json();
    const me = users.find((u) => u.username === "test-admin");
    expect(me).toBeDefined();

    const delRes = await request.delete(`${API_URL}/users/${me.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(delRes.status()).toBe(400);
    const body = await delRes.json();
    expect(body.error).toMatch(/cannot delete your own/i);
  });

  test("5. Admin can delete another user's account", async ({ request }) => {
    const ts = Date.now();
    const regRes = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `delete-me-${ts}`, password: "TestPass123!", role: "viewer" },
    });
    expect(regRes.ok()).toBeTruthy();
    const target = await regRes.json();

    const delRes = await request.delete(`${API_URL}/users/${target.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(delRes.ok()).toBeTruthy();
    const delBody = await delRes.json();
    expect(delBody.ok).toBe(true);

    // Verify the user is gone
    const listRes = await request.get(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const users = await listRes.json();
    expect(users.some((u) => u.username === `delete-me-${ts}`)).toBe(false);
  });

  test("6. Priority swap — two creators exchange priorities via API", async ({ request }) => {
    const ts = Date.now();

    // Register two creators (auto-priority: A=1, B=2)
    const aRes = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `creator-prio-a-${ts}`, password: "TestPass123!", role: "creator" },
    });
    expect(aRes.ok()).toBeTruthy();
    const userA = await aRes.json();

    const bRes = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `creator-prio-b-${ts}`, password: "TestPass123!", role: "creator" },
    });
    expect(bRes.ok()).toBeTruthy();
    const userB = await bRes.json();

    const prioA = userA.creator_priority;
    const prioB = userB.creator_priority;
    expect(prioA).not.toBe(prioB);

    // Admin swaps B to A's original priority
    const swapRes = await request.put(`${API_URL}/users/${userB.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { creator_priority: prioA },
    });
    expect(swapRes.ok()).toBeTruthy();
    const afterB = await swapRes.json();
    expect(afterB.creator_priority).toBe(prioA);

    // Verify A was bumped to B's original priority
    const listRes = await request.get(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const users = await listRes.json();
    const afterA = users.find((u) => u.id === userA.id);
    expect(afterA.creator_priority).toBe(prioB);
  });

  test("7. Managed groups drill-down — reflected in GET /auth/me", async ({ request }) => {
    const ts = Date.now();

    // Admin creates a creator with managed groups A and B
    const regRes = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        username: `drilldown-creator-${ts}`,
        password: "TestPass123!",
        role: "creator",
        managed_group_ids: JSON.stringify([groupA.id, groupB.id]),
      },
    });
    expect(regRes.ok()).toBeTruthy();
    const created = await regRes.json();
    expect(created.managed_group_ids).toEqual(
      expect.arrayContaining([groupA.id, groupB.id]),
    );

    // Log in as the new creator
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: `drilldown-creator-${ts}`, password: "TestPass123!" },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    const userToken = loginData.token;

    // Call GET /auth/me
    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(meRes.ok()).toBeTruthy();
    const me = await meRes.json();
    expect(me.managed_group_ids).toBeInstanceOf(Array);
    expect(me.managed_group_ids).toContain(groupA.id);
    expect(me.managed_group_ids).toContain(groupB.id);
    expect(me.managed_group_ids).toHaveLength(2);
  });
});

test.describe("Post API tests", () => {
  let adminToken;
  let creatorToken;

  test.beforeEach(async ({ request }) => {
    await resetState(request);
    adminToken = await loginTestAdmin(request);

    // Login as test-creator
    const creatorLogin = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    expect(creatorLogin.ok()).toBeTruthy();
    const creatorData = await creatorLogin.json();
    creatorToken = creatorData.token;
  });

  test("1. Admin global visibility — sees posts from all groups regardless of own group_id", async ({ request }) => {
    const ts = Date.now();

    // Create two groups
    const aRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `PostVis-A-${ts}` },
    });
    expect(aRes.ok()).toBeTruthy();
    const groupA = await aRes.json();

    const bRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `PostVis-B-${ts}` },
    });
    expect(bRes.ok()).toBeTruthy();
    const groupB = await bRes.json();

    // Create one post in each group
    const postA = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      multipart: {
        title: `Post-A-${ts}`,
        group_ids: JSON.stringify([groupA.id]),
        status: "published",
      },
    });
    expect(postA.ok()).toBeTruthy();

    const postB = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      multipart: {
        title: `Post-B-${ts}`,
        group_ids: JSON.stringify([groupB.id]),
        status: "published",
      },
    });
    expect(postB.ok()).toBeTruthy();

    // Admin lists all posts — should see both
    const listRes = await request.get(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const posts = await listRes.json();
    const titles = posts.map((p) => p.title);
    expect(titles).toContain(`Post-A-${ts}`);
    expect(titles).toContain(`Post-B-${ts}`);
  });

  test("2. Pending approval toggle — admin approves creator's feed request", async ({ request }) => {
    const ts = Date.now();

    // Create a group
    const gRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `ApprovalGroup-${ts}` },
    });
    expect(gRes.ok()).toBeTruthy();
    const group = await gRes.json();

    // Register a fresh creator with this group pre-assigned (auto_approve defaults to true in backend)
    const regRes = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        username: `approval-creator-${ts}`,
        password: "TestPass123!",
        role: "creator",
        managed_group_ids: JSON.stringify([group.id]),
        auto_approve: false,
      },
    });
    expect(regRes.ok()).toBeTruthy();

    // Login as the new creator
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: `approval-creator-${ts}`, password: "TestPass123!" },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    const freshCreatorToken = loginData.token;

    // Creator makes a post (for creators without auto_approve, both flags start false)
    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${freshCreatorToken}` },
      multipart: {
        title: `Pending Post ${ts}`,
        group_ids: JSON.stringify([group.id]),
        status: "published",
        allowed_on_feed: "false",
      },
    });
    expect(postRes.ok()).toBeTruthy();
    const postData = await postRes.json();
    const postId = postData.posts[0].id;

    // Creator requests feed approval via add-feed bulk action
    const reqRes = await request.post(`${API_URL}/posts/bulk-action`, {
      headers: { Authorization: `Bearer ${freshCreatorToken}` },
      data: { ids: [postId], action: "add-feed" },
    });
    expect(reqRes.ok()).toBeTruthy();

    // Verify the post now has requested_feed=true but allowed_on_feed=false
    const getRes = await request.get(`${API_URL}/posts/${postId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.ok()).toBeTruthy();
    const before = await getRes.json();
    expect(before.requested_feed).toBe(true);
    expect(before.allowed_on_feed).toBe(false);

    // Admin toggles allowed_on_feed to true
    const putRes = await request.put(`${API_URL}/posts/${postId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      multipart: {
        allowed_on_feed: "true",
      },
    });
    expect(putRes.ok()).toBeTruthy();

    // Verify the post is now allowed on feed
    const afterRes = await request.get(`${API_URL}/posts/${postId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(afterRes.ok()).toBeTruthy();
    const after = await afterRes.json();
    expect(after.allowed_on_feed).toBe(true);
    expect(after.requested_feed).toBe(true);
  });

  test("3. Cross-group bulk deletion — admin deletes posts from multiple groups at once", async ({ request }) => {
    const ts = Date.now();

    // Create three groups
    const g1 = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `BulkDel-1-${ts}` },
    });
    expect(g1.ok()).toBeTruthy();
    const group1 = await g1.json();

    const g2 = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `BulkDel-2-${ts}` },
    });
    expect(g2.ok()).toBeTruthy();
    const group2 = await g2.json();

    const g3 = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `BulkDel-3-${ts}` },
    });
    expect(g3.ok()).toBeTruthy();
    const group3 = await g3.json();

    // Create one post in each group
    const posts = [];
    for (const group of [group1, group2, group3]) {
      const pRes = await request.post(`${API_URL}/posts`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        multipart: {
          title: `BulkPost-${group.id}-${ts}`,
          group_ids: JSON.stringify([group.id]),
          status: "published",
        },
      });
      expect(pRes.ok()).toBeTruthy();
      const pData = await pRes.json();
      posts.push(pData.posts[0].id);
    }

    // Bulk delete all three
    const bulkRes = await request.post(`${API_URL}/posts/bulk-action`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { ids: posts, action: "delete" },
    });
    expect(bulkRes.ok()).toBeTruthy();
    const bulkBody = await bulkRes.json();
    expect(bulkBody.ok).toBe(true);

    // Verify posts are gone
    const listRes = await request.get(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const remaining = await listRes.json();
    const remainingIds = remaining.map((p) => p.id);
    for (const pid of posts) {
      expect(remainingIds).not.toContain(pid);
    }
  });

  test("4. Forced signage removal — delete_post_assets command emitted on delete", async ({ request }) => {
    const ts = Date.now();

    // Create a group
    const gRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `SignageRem-${ts}` },
    });
    expect(gRes.ok()).toBeTruthy();
    const group = await gRes.json();

    // Register, approve and set a device online in the group
    const devRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        device_name: "Signage Pi",
        ip_address: "192.168.1.250",
        group_id: group.id,
      },
    });
    expect(devRes.ok()).toBeTruthy();
    const device = await devRes.json();

    await request.post(`${API_URL}/devices/${device.id}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { group_id: group.id },
    });

    await request.put(`${API_URL}/devices/${device.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: "online" },
    });

    // Create a post (no image needed for this test)
    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      multipart: {
        title: `Signage Post ${ts}`,
        group_ids: JSON.stringify([group.id]),
        status: "published",
        allowed_on_signage: "true",
      },
    });
    expect(postRes.ok()).toBeTruthy();
    const postData = await postRes.json();
    const postId = postData.posts[0].id;

    // Seed a signage deployment so removePost has targets to emit to
    const scriptPath = path.resolve(__dirname, "../../backend/scripts/seedSignageDeployment.js");
    execSync(`node "${scriptPath}" ${postId} ${device.id}`, { cwd: path.resolve(__dirname, "../../backend"), encoding: "utf-8" });

    // Clear bridge-calls to isolate this test
    await request.post(`${API_URL}/test/bridge-calls/clear`).catch(() => {});

    // Delete the post
    const delRes = await request.delete(`${API_URL}/posts/${postId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(delRes.ok()).toBeTruthy();

    // Verify the bridge received delete_post_assets
    const bridgeRes = await request.get(`${API_URL}/test/bridge-calls`);
    expect(bridgeRes.ok()).toBeTruthy();
    const calls = await bridgeRes.json();
    const deleteCall = calls.find(
      (c) =>
        c.type === "ack" &&
        c.device_id === device.id &&
        c.event === "signage_command" &&
        c.data?.action === "delete_post_assets" &&
        c.data?.post_id === postId,
    );
    expect(deleteCall, "delete_post_assets should have been emitted after post deletion").toBeDefined();
  });
});

test.describe("Creator My Posts UI tests", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetState(request);

    // Clear any stale auth tokens from previous tests
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());

    // Log in as test-creator via UI
    await page.reload();
    await page.fill('input[name="username"]', "test-creator");
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/creator", { timeout: 5000 });
  });

  test("1. Page loads with My Posts heading and empty state", async ({ page }) => {
    await page.goto("/creator/posts");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('h1:has-text("My Posts")')).toBeVisible();
    await expect(page.locator('h2:has-text("New Post")')).toBeVisible();
    await expect(page.locator('h2:has-text("Posts (0)")')).toBeVisible();
  });

  test("2. Creator can create a post with image via UI", async ({ page }) => {
    await page.goto("/creator/posts");
    await page.waitForLoadState("networkidle");

    const ts = Date.now();

    // Fill title and description
    await page.locator('label:has-text("Title") + input').fill(`UI Post ${ts}`);
    await page.locator('label:has-text("Description") + textarea').fill("Test description from UI");

    // Upload mock image via the hidden file input
    const mockImage = path.resolve(__dirname, "MockMedia/Images/pexels-pixabay-267507.jpg");
    await page.locator('input[type="file"]').setInputFiles(mockImage);

    // Confirm cropper modal and apply
    await expect(page.locator('h3:has-text("Crop image")')).toBeVisible();
    await page.click('button:has-text("Apply crop")');
    await expect(page.locator('h3:has-text("Crop image")')).not.toBeVisible();

    // Check Publish to Feed
    await page.getByLabel("Publish to Feed").check();

    // Set status to published
    await page.locator('label:has-text("Post Status") + select').selectOption("published");

    // Save post
    await page.click('button:has-text("Save Post")');

    // Verify the post appears in the list (resetForm clears the success msg instantly,
    // so we verify by DOM state instead of toast)
    await expect(page.locator(`text=UI Post ${ts}`)).toBeVisible();
    await expect(page.locator('h2:has-text("Posts (1)")')).toBeVisible();
  });

  test("3. Creator can edit a post via UI", async ({ page, request }) => {
    const ts = Date.now();

    // Seed a post via API
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    const { token: creatorToken } = await loginRes.json();

    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    const me = await meRes.json();

    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      multipart: {
        title: `Edit Target ${ts}`,
        group_ids: JSON.stringify([me.group_id]),
        status: "published",
        allowed_on_feed: "true",
      },
    });
    expect(postRes.ok()).toBeTruthy();

    // Navigate to My Posts
    await page.goto("/creator/posts");
    await page.waitForLoadState("networkidle");

    // Click edit on the post
    await page.getByTitle("Edit post").first().click();

    // Verify form switched to edit mode
    await expect(page.locator('h2:has-text("Edit Post")')).toBeVisible();

    // Change title
    await page.locator('label:has-text("Title") + input').fill(`Updated Title ${ts}`);

    // Update
    await page.click('button:has-text("Update Post")');

    // Verify updated title in list (success msg is cleared by resetForm, so verify via DOM)
    await expect(page.locator(`text=Updated Title ${ts}`)).toBeVisible();
  });

  test("4. Creator can delete a post via UI", async ({ page, request }) => {
    const ts = Date.now();

    // Seed a post via API
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    const { token: creatorToken } = await loginRes.json();

    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    const me = await meRes.json();

    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      multipart: {
        title: `Delete Target ${ts}`,
        group_ids: JSON.stringify([me.group_id]),
        status: "published",
        allowed_on_feed: "true",
      },
    });
    expect(postRes.ok()).toBeTruthy();

    // Navigate to My Posts
    await page.goto("/creator/posts");
    await page.waitForLoadState("networkidle");

    // Handle confirmation dialogs
    page.on('dialog', async dialog => {
      if (dialog.type() === 'confirm') await dialog.accept();
    });

    // Click delete
    await page.getByTitle("Delete post").first().click();

    // Verify post is gone
    await expect(page.locator(`text=Delete Target ${ts}`)).not.toBeVisible();
    await expect(page.locator('h2:has-text("Posts (0)")')).toBeVisible();
  });

  test("5. Creator can filter posts by channel", async ({ page, request }) => {
    const ts = Date.now();

    // Seed posts via API
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    const { token: creatorToken } = await loginRes.json();

    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    const me = await meRes.json();

    // Feed-only post
    const feedRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      multipart: {
        title: `Feed Post ${ts}`,
        group_ids: JSON.stringify([me.group_id]),
        status: "published",
        allowed_on_feed: "true",
        allowed_on_signage: "false",
      },
    });
    expect(feedRes.ok()).toBeTruthy();

    // Signage post
    const signRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      multipart: {
        title: `Signage Post ${ts}`,
        group_ids: JSON.stringify([me.group_id]),
        status: "published",
        allowed_on_feed: "false",
        allowed_on_signage: "true",
      },
    });
    expect(signRes.ok()).toBeTruthy();

    // Navigate to My Posts
    await page.goto("/creator/posts");
    await page.waitForLoadState("networkidle");

    // Verify both posts visible initially
    await expect(page.locator(`text=Feed Post ${ts}`)).toBeVisible();
    await expect(page.locator(`text=Signage Post ${ts}`)).toBeVisible();

    // Filter by feed
    const feedPromise = page.waitForResponse(resp => resp.url().includes("/api/posts") && resp.status() === 200);
    await page.locator('label:has-text("Type") select').selectOption("feed");
    await feedPromise;

    await expect(page.locator(`text=Feed Post ${ts}`)).toBeVisible();
    await expect(page.locator(`text=Signage Post ${ts}`)).not.toBeVisible();

    // Filter by signage
    const signPromise = page.waitForResponse(resp => resp.url().includes("/api/posts") && resp.status() === 200);
    await page.locator('label:has-text("Type") select').selectOption("signage");
    await signPromise;

    await expect(page.locator(`text=Feed Post ${ts}`)).not.toBeVisible();
    await expect(page.locator(`text=Signage Post ${ts}`)).toBeVisible();

    // Reset to all
    const allPromise = page.waitForResponse(resp => resp.url().includes("/api/posts") && resp.status() === 200);
    await page.locator('label:has-text("Type") select').selectOption("all");
    await allPromise;

    await expect(page.locator(`text=Feed Post ${ts}`)).toBeVisible();
    await expect(page.locator(`text=Signage Post ${ts}`)).toBeVisible();
  });

  test("6. Creator can select all and bulk delete posts", async ({ page, request }) => {
    const ts = Date.now();

    // Seed multiple posts via API
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    const { token: creatorToken } = await loginRes.json();

    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    const me = await meRes.json();

    for (let i = 1; i <= 3; i++) {
      const postRes = await request.post(`${API_URL}/posts`, {
        headers: { Authorization: `Bearer ${creatorToken}` },
        multipart: {
          title: `Bulk Post ${i} ${ts}`,
          group_ids: JSON.stringify([me.group_id]),
          status: "published",
          allowed_on_feed: "true",
        },
      });
      expect(postRes.ok()).toBeTruthy();
    }

    // Navigate to My Posts
    await page.goto("/creator/posts");
    await page.waitForLoadState("networkidle");

    // Verify posts exist
    for (let i = 1; i <= 3; i++) {
      await expect(page.locator(`text=Bulk Post ${i} ${ts}`)).toBeVisible();
    }

    // Click "Select Mine" to select all manageable posts
    await page.click('button:has-text("Select Mine")');

    // Verify bulk action bar appears with correct count
    await expect(page.locator('text=3 items selected')).toBeVisible();

    // Handle bulk delete confirmation
    page.on('dialog', async dialog => {
      if (dialog.type() === 'confirm') await dialog.accept();
    });

    // Click bulk delete
    await page.click('button:has-text("🗑 Delete")');

    // Verify all posts are gone
    for (let i = 1; i <= 3; i++) {
      await expect(page.locator(`text=Bulk Post ${i} ${ts}`)).not.toBeVisible();
    }
    await expect(page.locator('h2:has-text("Posts (0)")')).toBeVisible();
  });

  test("7. Horizontal isolation — other creator's post is view-only", async ({ page, request }) => {
    const ts = Date.now();

    // Register two creators in the same group
    const adminToken = await loginTestAdmin(request);
    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `SharedGroup-${ts}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    const group = await groupRes.json();

    const regA = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `creator-a-${ts}`, password: "TestPass123!", role: "creator", managed_group_ids: JSON.stringify([group.id]) },
    });
    expect(regA.ok()).toBeTruthy();

    const regB = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `creator-b-${ts}`, password: "TestPass123!", role: "creator", managed_group_ids: JSON.stringify([group.id]) },
    });
    expect(regB.ok()).toBeTruthy();

    // Log in as Creator A and create a post
    const loginA = await request.post(`${API_URL}/auth/login`, {
      data: { username: `creator-a-${ts}`, password: "TestPass123!" },
    });
    const { token: tokenA } = await loginA.json();

    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      multipart: {
        title: `A Secret Post ${ts}`,
        group_ids: JSON.stringify([group.id]),
        status: "published",
        allowed_on_feed: "true",
      },
    });
    expect(postRes.ok()).toBeTruthy();

    // Log in as Creator B via UI
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('input[name="username"]', `creator-b-${ts}`);
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/creator", { timeout: 5000 });

    // Navigate to My Posts
    await page.goto("/creator/posts");
    await page.waitForLoadState("networkidle");

    // Verify the post is visible but marked view-only
    await expect(page.locator(`text=A Secret Post ${ts}`)).toBeVisible();
    await expect(page.locator('text=view only')).toBeVisible();

    // Verify edit and delete buttons are disabled (titles change when canManage is false)
    const editBtn = page.getByTitle("Admin approval is required to edit this post").first();
    const delBtn = page.getByTitle("Admin approval is required to delete this post").first();
    await expect(editBtn).toBeDisabled();
    await expect(delBtn).toBeDisabled();

    // Verify checkbox is disabled
    const checkbox = page.locator('input[type="checkbox"][title^="Admin approval"]').first();
    await expect(checkbox).toBeDisabled();
  });

  test("8. Validation — missing media blocks save", async ({ page }) => {
    await page.goto("/creator/posts");
    await page.waitForLoadState("networkidle");

    // Fill title and description without uploading media
    await page.locator('label:has-text("Title") + input').fill("No Media Post");
    await page.locator('label:has-text("Description") + textarea').fill("This post has no media");

    // Try to save
    await page.click('button:has-text("Save Post")');

    // Verify validation error appears
    await expect(page.locator('text=❌ Add at least one image or video.')).toBeVisible();

    // Verify the post was NOT created
    await expect(page.locator('text=No Media Post')).not.toBeVisible();
  });

  test("9. Bulk action guardrail — + Signage without displays triggers alert", async ({ page, request }) => {
    const ts = Date.now();

    // Seed a post via API
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    const { token: creatorToken } = await loginRes.json();

    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    const me = await meRes.json();

    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      multipart: {
        title: `Guardrail Post ${ts}`,
        group_ids: JSON.stringify([me.group_id]),
        status: "published",
        allowed_on_feed: "true",
      },
    });
    expect(postRes.ok()).toBeTruthy();

    // Navigate to My Posts
    await page.goto("/creator/posts");
    await page.waitForLoadState("networkidle");

    // Select the post
    await page.click('button:has-text("Select Mine")');
    await expect(page.locator('text=1 items selected')).toBeVisible();

    // Intercept the alert from bulkAction guardrail
    let alertMessage = "";
    page.on("dialog", async (dialog) => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    // Click + Signage without choosing any displays
    await page.click('button:has-text("+ Signage")');

    // Verify the guardrail alert fired
    expect(alertMessage).toContain("select at least one display");
  });

  test("10. Filter by Creator dropdown shows only selected creator's posts", async ({ page, request }) => {
    const ts = Date.now();

    // Register two creators in the same group via admin
    const adminToken = await loginTestAdmin(request);
    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `CreatorFilterGroup-${ts}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    const group = await groupRes.json();

    const regA = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `cf-creator-a-${ts}`, password: "TestPass123!", role: "creator", group_id: group.id, managed_group_ids: JSON.stringify([group.id]) },
    });
    expect(regA.ok()).toBeTruthy();
    const userA = await regA.json();

    const regB = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `cf-creator-b-${ts}`, password: "TestPass123!", role: "creator", group_id: group.id, managed_group_ids: JSON.stringify([group.id]) },
    });
    expect(regB.ok()).toBeTruthy();
    const userB = await regB.json();

    // Log in as A and create a post
    const loginA = await request.post(`${API_URL}/auth/login`, {
      data: { username: `cf-creator-a-${ts}`, password: "TestPass123!" },
    });
    const { token: tokenA } = await loginA.json();
    const postA = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      multipart: {
        title: `Post By A ${ts}`,
        group_ids: JSON.stringify([group.id]),
        status: "published",
        allowed_on_feed: "true",
      },
    });
    expect(postA.ok()).toBeTruthy();

    // Log in as B and create a post
    const loginB = await request.post(`${API_URL}/auth/login`, {
      data: { username: `cf-creator-b-${ts}`, password: "TestPass123!" },
    });
    const { token: tokenB } = await loginB.json();
    const postB = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      multipart: {
        title: `Post By B ${ts}`,
        group_ids: JSON.stringify([group.id]),
        status: "published",
        allowed_on_feed: "true",
      },
    });
    expect(postB.ok()).toBeTruthy();

    // Log in as test-creator (who manages the group) via UI to see both posts
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('input[name="username"]', "test-creator");
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/creator", { timeout: 5000 });

    // Assign the group to test-creator so they can manage both posts
    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const meAdmin = await meRes.json();

    // Actually, test-creator only sees their own group's posts.
    // Instead, log in as creator-a who can see their own post and creator-b's post in the same group
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('input[name="username"]', `cf-creator-a-${ts}`);
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/creator", { timeout: 5000 });

    await page.goto("/creator/posts");
    await page.waitForLoadState("networkidle");

    // Verify both posts are visible initially
    await expect(page.locator(`text=Post By A ${ts}`)).toBeVisible();
    await expect(page.locator(`text=Post By B ${ts}`)).toBeVisible();

    // Filter by Creator A in the dropdown
    const creatorSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'All creators in group' }) });

    const filterPromise = page.waitForResponse(resp => resp.url().includes("/api/posts") && resp.status() === 200);
    await creatorSelect.selectOption(String(userA.id));
    await filterPromise;

    await expect(page.locator(`text=Post By A ${ts}`)).toBeVisible();
    await expect(page.locator(`text=Post By B ${ts}`)).not.toBeVisible();

    // Filter by Creator B
    const filterPromiseB = page.waitForResponse(resp => resp.url().includes("/api/posts") && resp.status() === 200);
    await creatorSelect.selectOption(String(userB.id));
    await filterPromiseB;

    await expect(page.locator(`text=Post By A ${ts}`)).not.toBeVisible();
    await expect(page.locator(`text=Post By B ${ts}`)).toBeVisible();
  });
});

test.describe("Creator Signage UI tests", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetState(request);
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('input[name="username"]', "test-creator");
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/creator", { timeout: 5000 });
  });

  test("1. Page loads with Publish to Signage heading and empty state", async ({ page }) => {
    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('h1:has-text("Publish to Signage")')).toBeVisible();
    await expect(page.locator('h2:has-text("Signage Publish")')).toBeVisible();
    await expect(page.locator('h2:has-text("Display Assets")')).toBeVisible();
    await expect(page.locator('text=Select a display to see its assets.')).toBeVisible();
  });

  test("2. Publish form validation blocks submission without post or device", async ({ page }) => {
    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");

    await page.click('button:has-text("Publish to Display")');
    // HTML5 validation should prevent submission
    await expect(page.locator('text=✅ Published')).not.toBeVisible();
    await expect(page.locator('text=⚠️ Saved on server')).not.toBeVisible();
  });

  test("3. Publish a post to an online display via mock bridge shows success", async ({ page, request }) => {
    const ts = Date.now();

    // Log in as test-creator and get group info
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    const { token: creatorToken } = await loginRes.json();

    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    const me = await meRes.json();

    // Create a post with an image via API
    const imagePath = path.resolve(__dirname, "MockMedia/Images/pexels-pixabay-267507.jpg");
    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      multipart: {
        title: `Signage Post ${ts}`,
        group_ids: JSON.stringify([me.group_id]),
        status: "published",
        allowed_on_signage: "true",
        images: { name: "test.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(imagePath) },
      },
    });
    expect(postRes.ok()).toBeTruthy();
    const postData = await postRes.json();
    const postId = postData.posts[0].id;

    // Register, approve, and set online a device in the same group
    const adminToken = await loginTestAdmin(request);
    const deviceRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { device_name: `Test Display ${ts}`, ip_address: "192.168.1.100", group_id: me.group_id },
    });
    expect(deviceRes.ok()).toBeTruthy();
    const device = await deviceRes.json();

    await request.post(`${API_URL}/devices/${device.id}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { group_id: me.group_id },
    });
    await request.put(`${API_URL}/devices/${device.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: "online" },
    });

    // Navigate to Signage page
    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");

    // Select post and device, then publish
    await page.locator('label:has-text("Post") + select').selectOption(String(postId));
    await page.locator('label:has-text("Target Display") + select').selectOption(String(device.id));
    await page.click('button:has-text("Publish to Display")');

    // Verify success message (mock Pi bridge returns ok:true for publish)
    await expect(page.locator('text=✅ Published — display updated.')).toBeVisible({ timeout: 10000 });
  });

  test("4. Previous/Next/Refresh buttons disabled without device", async ({ page }) => {
    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('button:has-text("Previous")')).toBeDisabled();
    await expect(page.locator('button:has-text("Next")')).toBeDisabled();
    await expect(page.locator('button:has-text("Refresh")')).toBeDisabled();
  });

  test("5. Asset list shows stale seeded assets after selecting a display", async ({ page, request }) => {
    const ts = Date.now();

    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    const { token: creatorToken } = await loginRes.json();

    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    const me = await meRes.json();

    // Create a post with an image
    const imagePath = path.resolve(__dirname, "MockMedia/Images/pexels-pixabay-267507.jpg");
    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      multipart: {
        title: `Asset Post ${ts}`,
        group_ids: JSON.stringify([me.group_id]),
        status: "published",
        allowed_on_signage: "true",
        images: { name: "test.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(imagePath) },
      },
    });
    expect(postRes.ok()).toBeTruthy();
    const postData = await postRes.json();
    const postId = postData.posts[0].id;

    // Register and approve a device
    const adminToken = await loginTestAdmin(request);
    const deviceRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { device_name: `Asset Display ${ts}`, ip_address: "192.168.1.101", group_id: me.group_id },
    });
    expect(deviceRes.ok()).toBeTruthy();
    const device = await deviceRes.json();

    await request.post(`${API_URL}/devices/${device.id}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { group_id: me.group_id },
    });
    await request.put(`${API_URL}/devices/${device.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: "online" },
    });

    // Seed a signage asset directly in the DB so the stale list has data
    const assetScript = path.resolve(__dirname, "../../backend/scripts/seedSignageAsset.js");
    execSync(`node "${assetScript}" ${postId} ${device.id} asset-${ts}`, { cwd: path.resolve(__dirname, "../../backend"), encoding: "utf-8" });

    // Navigate and select the device
    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");
    await page.locator('label:has-text("Target Display") + select').selectOption(String(device.id));

    // Verify the stale asset appears (exact text avoids matching the dropdown option)
    await expect(page.getByText(`Asset Post ${ts}`, { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Image · Visible · 10s')).toBeVisible();
  });

  test("6. Display command succeeds via mock bridge", async ({ page, request }) => {
    const ts = Date.now();

    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    const { token: creatorToken } = await loginRes.json();

    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    const me = await meRes.json();

    // Create a post with an image
    const imagePath = path.resolve(__dirname, "MockMedia/Images/pexels-pixabay-267507.jpg");
    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      multipart: {
        title: `Command Post ${ts}`,
        group_ids: JSON.stringify([me.group_id]),
        status: "published",
        allowed_on_signage: "true",
        images: { name: "test.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(imagePath) },
      },
    });
    expect(postRes.ok()).toBeTruthy();
    const postData = await postRes.json();
    const postId = postData.posts[0].id;

    // Register and approve a device
    const adminToken = await loginTestAdmin(request);
    const deviceRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { device_name: `Command Display ${ts}`, ip_address: "192.168.1.102", group_id: me.group_id },
    });
    expect(deviceRes.ok()).toBeTruthy();
    const device = await deviceRes.json();

    await request.post(`${API_URL}/devices/${device.id}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { group_id: me.group_id },
    });
    await request.put(`${API_URL}/devices/${device.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: "online" },
    });

    // Seed a signage asset
    const assetScript = path.resolve(__dirname, "../../backend/scripts/seedSignageAsset.js");
    execSync(`node "${assetScript}" ${postId} ${device.id} asset-cmd-${ts}`, { cwd: path.resolve(__dirname, "../../backend"), encoding: "utf-8" });

    // Navigate and select the device
    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");
    await page.locator('label:has-text("Target Display") + select').selectOption(String(device.id));

    // Wait for asset to appear (exact text avoids matching the dropdown option)
    await expect(page.getByText(`Command Post ${ts}`, { exact: true })).toBeVisible({ timeout: 10000 });

    // Click Start — mock Pi bridge returns ok:true for controls
    await page.locator('button:has-text("Start")').first().click();
    await expect(page.locator('text=✅ Display command sent.')).toBeVisible({ timeout: 10000 });
  });

  test("7. Horizontal isolation — other creator's asset is view-only", async ({ page, request }) => {
    test.setTimeout(60000);
    const ts = Date.now();

    // Register two creators in the same group via admin
    const adminToken = await loginTestAdmin(request);
    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `IsoGroup-${ts}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    const group = await groupRes.json();

    const regA = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `iso-creator-a-${ts}`, password: "TestPass123!", role: "creator", group_id: group.id, managed_group_ids: JSON.stringify([group.id]) },
    });
    expect(regA.ok()).toBeTruthy();
    const userA = await regA.json();

    const regB = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `iso-creator-b-${ts}`, password: "TestPass123!", role: "creator", group_id: group.id, managed_group_ids: JSON.stringify([group.id]) },
    });
    expect(regB.ok()).toBeTruthy();
    const userB = await regB.json();

    // Log in as A and create a post with image
    const loginA = await request.post(`${API_URL}/auth/login`, {
      data: { username: `iso-creator-a-${ts}`, password: "TestPass123!" },
    });
    const { token: tokenA } = await loginA.json();
    const imagePath = path.resolve(__dirname, "MockMedia/Images/pexels-pixabay-267507.jpg");
    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      multipart: {
        title: `Iso Post ${ts}`,
        group_ids: JSON.stringify([group.id]),
        status: "published",
        allowed_on_signage: "true",
        images: { name: "test.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(imagePath) },
      },
    });
    expect(postRes.ok()).toBeTruthy();
    const postData = await postRes.json();
    const postId = postData.posts[0].id;

    // Register and approve a device
    const deviceRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { device_name: `Iso Display ${ts}`, ip_address: "192.168.1.150", group_id: group.id },
    });
    expect(deviceRes.ok()).toBeTruthy();
    const device = await deviceRes.json();
    await request.post(`${API_URL}/devices/${device.id}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { group_id: group.id },
    });
    await request.put(`${API_URL}/devices/${device.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: "online" },
    });

    // Creator A publishes to the device
    await request.post(`${API_URL}/signage/publish`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: { post_id: postId, device_id: device.id, duration_seconds: 10, priority: 1 },
    });

    // Log in as Creator B via UI
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('input[name="username"]', `iso-creator-b-${ts}`);
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/creator", { timeout: 5000 });

    // Navigate to Signage and select the device
    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");
    await page.locator('label:has-text("Target Display") + select').selectOption(String(device.id));

    // Verify asset is visible but not manageable
    await expect(page.getByText(`Iso Post ${ts}`, { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Hide")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Delete")')).toHaveCount(0);
    await expect(page.locator('text=view only')).toBeVisible();
  });

  test("8. Priority lock — higher-priority-number creator blocks lower-priority-number control", async ({ page, request }) => {
    test.setTimeout(60000);
    const ts = Date.now();

    // Register two creators in the same group (A = priority 2, B = priority 3)
    const adminToken = await loginTestAdmin(request);
    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `LockGroup-${ts}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    const group = await groupRes.json();

    const regA = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `lock-creator-a-${ts}`, password: "TestPass123!", role: "creator", group_id: group.id, managed_group_ids: JSON.stringify([group.id]) },
    });
    expect(regA.ok()).toBeTruthy();
    const userA = await regA.json();

    const regB = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `lock-creator-b-${ts}`, password: "TestPass123!", role: "creator", group_id: group.id, managed_group_ids: JSON.stringify([group.id]) },
    });
    expect(regB.ok()).toBeTruthy();

    // Register and approve a device
    const deviceRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { device_name: `Lock Display ${ts}`, ip_address: "192.168.1.151", group_id: group.id },
    });
    expect(deviceRes.ok()).toBeTruthy();
    const device = await deviceRes.json();
    await request.post(`${API_URL}/devices/${device.id}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { group_id: group.id },
    });
    await request.put(`${API_URL}/devices/${device.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: "online" },
    });

    // Creator A creates a post (no image needed; asset is seeded directly)
    const loginA = await request.post(`${API_URL}/auth/login`, {
      data: { username: `lock-creator-a-${ts}`, password: "TestPass123!" },
    });
    const { token: tokenA } = await loginA.json();
    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      multipart: {
        title: `Lock Post ${ts}`,
        group_ids: JSON.stringify([group.id]),
        status: "published",
        allowed_on_signage: "true",
      },
    });
    expect(postRes.ok()).toBeTruthy();
    const postData = await postRes.json();
    const postId = postData.posts[0].id;

    // Seed the signage asset directly (bypass publish so no control lock is applied)
    const seedScript = path.resolve(__dirname, "../../backend/scripts/seedSignageAsset.js");
    execSync(`node "${seedScript}" ${postId} ${device.id} "lock-asset-${ts}"`, { cwd: path.resolve(__dirname, "../../backend"), encoding: "utf-8" });

    // Log in as Creator B (higher priority number) and click Next to lock the device
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('input[name="username"]', `lock-creator-b-${ts}`);
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/creator", { timeout: 5000 });

    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");
    await page.locator('label:has-text("Target Display") + select').selectOption(String(device.id));
    await page.locator('button:has-text("Next")').click();
    await expect(page.locator('text=✅ Display command sent.')).toBeVisible({ timeout: 10000 });

    // Log in as Creator A (lower priority number) and try to hide their asset
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.fill('input[name="username"]', `lock-creator-a-${ts}`);
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/creator", { timeout: 5000 });

    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");
    await page.locator('label:has-text("Target Display") + select').selectOption(String(device.id));
    await expect(page.getByText(`Lock Post ${ts}`, { exact: true })).toBeVisible({ timeout: 10000 });

    // Click Hide on the asset — should be blocked by B's higher-priority-number lock
    await page.locator('button:has-text("Hide")').first().click();
    await expect(page.locator('text=Display is locked by a higher-priority creator')).toBeVisible({ timeout: 10000 });
  });

  test("9. Urgency mode — NORMAL post filtered from Pi pull when group is EMERGENCY", async ({ page, request }) => {
    test.setTimeout(60000);
    const ts = Date.now();

    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    const { token: creatorToken } = await loginRes.json();

    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    const me = await meRes.json();

    // Create a NORMAL post with image
    const imagePath = path.resolve(__dirname, "MockMedia/Images/pexels-pixabay-267507.jpg");
    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      multipart: {
        title: `Urgency Post ${ts}`,
        group_ids: JSON.stringify([me.group_id]),
        status: "published",
        allowed_on_signage: "true",
        images: { name: "test.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(imagePath) },
      },
    });
    expect(postRes.ok()).toBeTruthy();
    const postData = await postRes.json();
    const postId = postData.posts[0].id;

    // Register and approve a device
    const adminToken = await loginTestAdmin(request);
    const deviceRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { device_name: `Urgency Display ${ts}`, ip_address: "192.168.1.200", group_id: me.group_id },
    });
    expect(deviceRes.ok()).toBeTruthy();
    const device = await deviceRes.json();
    await request.post(`${API_URL}/devices/${device.id}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { group_id: me.group_id },
    });
    await request.put(`${API_URL}/devices/${device.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: "online" },
    });

    // Publish post to device
    await request.post(`${API_URL}/signage/publish`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      data: { post_id: postId, device_id: device.id, duration_seconds: 10, priority: 1 },
    });

    // Set group to EMERGENCY
    await request.put(`${API_URL}/groups/${me.group_id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { signage_state: "EMERGENCY" },
    });

    // Pi pull endpoint should NOT include the NORMAL post
    const pullEmergency = await request.get(`${API_URL}/signage/device/${device.id}/deployments`);
    expect(pullEmergency.ok()).toBeTruthy();
    const dataEmergency = await pullEmergency.json();
    expect(dataEmergency.some((d) => d.post_id === postId)).toBeFalsy();

    // Set group back to NORMAL
    await request.put(`${API_URL}/groups/${me.group_id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { signage_state: "NORMAL" },
    });

    // Pi pull endpoint SHOULD include the NORMAL post
    const pullNormal = await request.get(`${API_URL}/signage/device/${device.id}/deployments`);
    expect(pullNormal.ok()).toBeTruthy();
    const dataNormal = await pullNormal.json();
    expect(dataNormal.some((d) => d.post_id === postId)).toBeTruthy();

    // UI asset list still shows the asset (current behavior: UI doesn't filter by urgency)
    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");
    await page.locator('label:has-text("Target Display") + select').selectOption(String(device.id));
    await expect(page.getByText(`Urgency Post ${ts}`, { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test("10. Media type responsiveness — video post hides slide duration input", async ({ page, request }) => {
    const ts = Date.now();

    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    const { token: creatorToken } = await loginRes.json();

    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    const me = await meRes.json();

    // Seed a video post directly in the DB
    const videoScript = path.resolve(__dirname, "../../backend/scripts/seedVideoPost.js");
    execSync(`node "${videoScript}" ${me.group_id} ${me.id} "Video Post ${ts}"`, { cwd: path.resolve(__dirname, "../../backend"), encoding: "utf-8" });

    // Navigate to Signage page
    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");

    // Select the video post
    await page.locator('label:has-text("Post") + select').selectOption((await page.locator('label:has-text("Post") + select option').filter({ hasText: `Video Post ${ts}` }).first().getAttribute("value")));

    // Verify slide duration input is gone and video message appears
    await expect(page.locator('label:has-text("Slide duration")')).toHaveCount(0);
    await expect(page.locator('text=Video length is set by the trimmed file')).toBeVisible();
  });

  test("11. True offline handling — publish to offline display shows cancellation error", async ({ page, request }) => {
    test.setTimeout(60000);
    const ts = Date.now();

    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    const { token: creatorToken } = await loginRes.json();

    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    const me = await meRes.json();

    // Create a post with image
    const imagePath = path.resolve(__dirname, "MockMedia/Images/pexels-pixabay-267507.jpg");
    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      multipart: {
        title: `Offline Post ${ts}`,
        group_ids: JSON.stringify([me.group_id]),
        status: "published",
        allowed_on_signage: "true",
        images: { name: "test.jpg", mimeType: "image/jpeg", buffer: fs.readFileSync(imagePath) },
      },
    });
    expect(postRes.ok()).toBeTruthy();
    const postData = await postRes.json();
    const postId = postData.posts[0].id;

    // Register, approve, and set OFFLINE a device
    const adminToken = await loginTestAdmin(request);
    const deviceRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { device_name: `Offline Display ${ts}`, ip_address: "192.168.1.250", group_id: me.group_id },
    });
    expect(deviceRes.ok()).toBeTruthy();
    const device = await deviceRes.json();
    await request.post(`${API_URL}/devices/${device.id}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { group_id: me.group_id },
    });
    await request.put(`${API_URL}/devices/${device.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: "offline" },
    });

    // Navigate to Signage page and try to publish
    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");
    await page.locator('label:has-text("Post") + select').selectOption(String(postId));
    await page.locator('label:has-text("Target Display") + select').selectOption(String(device.id));
    await page.click('button:has-text("Publish to Display")');

    // Verify the offline error message
    await expect(page.locator(`text=❌ Update cancelled. These displays are offline: Offline Display ${ts}`)).toBeVisible({ timeout: 10000 });
  });
});
