import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

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

test.describe.configure({ mode: "serial" });

test.describe("happy path smoke tests", () => {
  let token;

  test.beforeAll(async ({ request }) => {
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
});

test.describe("Device lifecycle API tests", () => {
  let adminToken;
  let creatorToken;
  let group;
  let deviceId;

  test.beforeAll(async ({ request }) => {
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
    const updateRes = await request.put(`${API_URL}/devices/${deviceId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { location: "Science Wing, Room 302", all_groups: true },
    });
    expect(updateRes.ok()).toBeTruthy();
    const updated = await updateRes.json();
    expect(updated.location).toBe("Science Wing, Room 302");
    expect(updated.all_groups).toBe(true);

    // Verify DB reflects changes via GET
    const getRes = await request.get(`${API_URL}/devices/${deviceId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.ok()).toBeTruthy();
    const device = await getRes.json();
    expect(device.location).toBe("Science Wing, Room 302");
    expect(device.all_groups).toBe(true);
  });

  test("3. Cleanup flow — secure deletion with clear_all", async ({ request }) => {
    // Mark device as online so the delete path triggers the socket emit
    const statusRes = await request.put(`${API_URL}/devices/${deviceId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: "online" },
    });
    expect(statusRes.ok()).toBeTruthy();

    // Delete the device
    const deleteRes = await request.delete(`${API_URL}/devices/${deviceId}`, {
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
        c.device_id === deviceId &&
        c.event === "signage_command" &&
        c.data?.action === "clear_all",
    );
    expect(clearAllCall, "clear_all command should have been emitted to the device").toBeDefined();

    // Verify the device no longer exists in the DB
    const getRes = await request.get(`${API_URL}/devices/${deviceId}`, {
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

    // Clean up as admin
    const adminDel = await request.delete(`${API_URL}/devices/${rbacDeviceId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(adminDel.ok()).toBeTruthy();
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

    // Clean up
    await request.delete(`${API_URL}/devices/${device.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  });
});

test.describe("Group API hardening tests", () => {
  let adminToken;

  test.beforeAll(async ({ request }) => {
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

    // Clean up
    await request.delete(`${API_URL}/devices/${dev.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    await request.delete(`${API_URL}/groups/${grp.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
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

    // Clean up groups
    await request.delete(`${API_URL}/groups/${groupA.id}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    await request.delete(`${API_URL}/groups/${groupB.id}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    await request.delete(`${API_URL}/groups/${groupC.id}`, { headers: { Authorization: `Bearer ${adminToken}` } });
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

  test.beforeAll(async ({ request }) => {
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

    // Clean up
    await request.delete(`${API_URL}/users/${created.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
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

    // Clean up
    await request.delete(`${API_URL}/users/${target.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
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

    // Clean up
    await request.delete(`${API_URL}/users/${userA.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    await request.delete(`${API_URL}/users/${userB.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
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

    // Clean up
    await request.delete(`${API_URL}/users/${created.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  });
});
