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
