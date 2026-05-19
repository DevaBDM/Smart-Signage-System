import { test, expect } from "@playwright/test";
import fs from "fs";
import {
  resetState,
  loginTestAdmin,
  loginAs,
  API_URL,
  mockImagePath,
  miniPngBuffer,
  seedSignageAsset,
  seedVideoPost,
} from "../helpers/test-helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Creator Signage UI tests", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetState(request);
    await loginAs(page, "test-creator", "TestPass123!");
  });

  test("publish to signage and approve device", async ({ request }) => {
    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${await loginTestAdmin(request)}` },
      data: { name: `SignageGroup-${Date.now()}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    const group = await groupRes.json();

    const miniPng = miniPngBuffer();

    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${await loginTestAdmin(request)}` },
      multipart: {
        title: "Signage Post",
        group_ids: JSON.stringify([group.id]),
        status: "published",
        allowed_on_signage: "true",
        images: { name: "test.png", mimeType: "image/png", buffer: miniPng },
      },
    });
    expect(postRes.ok()).toBeTruthy();
    const postData = await postRes.json();
    const postId = postData.posts[0].id;

    const deviceRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${await loginTestAdmin(request)}` },
      data: { device_name: "Smoke Pi", ip_address: "192.168.1.99", group_id: group.id },
    });
    expect(deviceRes.ok()).toBeTruthy();
    const device = await deviceRes.json();

    const statusRes = await request.put(`${API_URL}/devices/${device.id}`, {
      headers: { Authorization: `Bearer ${await loginTestAdmin(request)}` },
      data: { status: "online" },
    });
    expect(statusRes.ok()).toBeTruthy();

    const publishRes = await request.post(`${API_URL}/signage/publish`, {
      headers: { Authorization: `Bearer ${await loginTestAdmin(request)}` },
      data: { post_id: postId, device_id: device.id, duration_seconds: 10 },
    });
    expect(publishRes.ok()).toBeTruthy();
    const pubBody = await publishRes.json();
    expect(pubBody.ok).toBe(true);
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
    await expect(page.locator('text=✅ Published')).not.toBeVisible();
    await expect(page.locator('text=⚠️ Saved on server')).not.toBeVisible();
  });

  test("3. Publish a post to an online display via mock bridge shows success", async ({ page, request }) => {
    const ts = Date.now();

    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    const { token: creatorToken } = await loginRes.json();

    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    const me = await meRes.json();

    const imagePath = mockImagePath();
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

    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");

    await page.locator('label:has-text("Post") + select').selectOption(String(postId));
    await page.locator('label:has-text("Target Display") + select').selectOption(String(device.id));
    await page.click('button:has-text("Publish to Display")');

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

    const imagePath = mockImagePath();
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

    seedSignageAsset(postId, device.id, `asset-${ts}`);

    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");
    await page.locator('label:has-text("Target Display") + select').selectOption(String(device.id));

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

    const imagePath = mockImagePath();
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

    seedSignageAsset(postId, device.id, `asset-cmd-${ts}`);

    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");
    await page.locator('label:has-text("Target Display") + select').selectOption(String(device.id));

    await expect(page.getByText(`Command Post ${ts}`, { exact: true })).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("Start")').first().click();
    await expect(page.locator('text=✅ Display command sent.')).toBeVisible({ timeout: 10000 });
  });

  test("7. Horizontal isolation — other creator's asset is view-only", async ({ page, request }) => {
    test.setTimeout(60000);
    const ts = Date.now();

    const adminToken = await loginTestAdmin(request);
    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `IsoGroup-${ts}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    const group = await groupRes.json();

    const regA = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `iso-creator-a-${ts}`, password: "TestPass123!", role: "creator", group_id: group.id, managed_group_ids: JSON.stringify([group.id]), auto_approve: true },
    });
    expect(regA.ok()).toBeTruthy();
    const userA = await regA.json();

    const regB = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `iso-creator-b-${ts}`, password: "TestPass123!", role: "creator", group_id: group.id, managed_group_ids: JSON.stringify([group.id]), auto_approve: true },
    });
    expect(regB.ok()).toBeTruthy();
    const userB = await regB.json();

    const loginA = await request.post(`${API_URL}/auth/login`, {
      data: { username: `iso-creator-a-${ts}`, password: "TestPass123!" },
    });
    const { token: tokenA } = await loginA.json();
    const imagePath = mockImagePath();
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

    await request.post(`${API_URL}/signage/publish`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      data: { post_id: postId, device_id: device.id, duration_seconds: 10, priority: 1 },
    });

    await page.evaluate(() => localStorage.clear());
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.fill('input[name="username"]', `iso-creator-b-${ts}`);
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/creator", { timeout: 5000 });

    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");
    await page.locator('label:has-text("Target Display") + select').selectOption(String(device.id));

    await expect(page.getByText(`Iso Post ${ts}`, { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Hide")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Delete")')).toHaveCount(0);
    await expect(page.locator('text=view only')).toBeVisible();
  });

  test("8. Priority lock — higher-priority-number creator blocks lower-priority-number control", async ({ page, request }) => {
    test.setTimeout(60000);
    const ts = Date.now();

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

    seedSignageAsset(postId, device.id, `lock-asset-${ts}`);

    await page.evaluate(() => localStorage.clear());
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.fill('input[name="username"]', `lock-creator-b-${ts}`);
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/creator", { timeout: 5000 });

    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");
    await page.locator('label:has-text("Target Display") + select').selectOption(String(device.id));
    await page.locator('button:has-text("Next")').click();
    await expect(page.locator('text=✅ Display command sent.')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => localStorage.clear());
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.fill('input[name="username"]', `lock-creator-a-${ts}`);
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/creator", { timeout: 5000 });

    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");
    await page.locator('label:has-text("Target Display") + select').selectOption(String(device.id));
    await expect(page.getByText(`Lock Post ${ts}`, { exact: true })).toBeVisible({ timeout: 10000 });

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

    const imagePath = mockImagePath();
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

    const adminToken = await loginTestAdmin(request);
    const deviceRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { device_name: `Urgency Display ${ts}`, ip_address: "192.168.1.200", group_id: me.group_id },
    });
    expect(deviceRes.ok()).toBeTruthy();
    const device = await deviceRes.json();
    const approveRes = await request.post(`${API_URL}/devices/${device.id}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { group_id: me.group_id },
    });
    expect(approveRes.ok()).toBeTruthy();
    const approvedDevice = await approveRes.json();
    const deviceToken = approvedDevice.device_token;

    await request.put(`${API_URL}/devices/${device.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { status: "online" },
    });

    await request.post(`${API_URL}/signage/publish`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      data: { post_id: postId, device_id: device.id, duration_seconds: 10, priority: 1 },
    });

    await request.put(`${API_URL}/groups/${me.group_id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { signage_state: "EMERGENCY" },
    });

    const pullEmergency = await request.get(`${API_URL}/signage/device/${device.id}/deployments`, {
      headers: { Authorization: `Bearer ${deviceToken}` },
    });
    expect(pullEmergency.ok()).toBeTruthy();
    const dataEmergency = await pullEmergency.json();
    expect(dataEmergency.some((d) => d.post_id === postId)).toBeFalsy();

    await request.put(`${API_URL}/groups/${me.group_id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { signage_state: "NORMAL" },
    });

    const pullNormal = await request.get(`${API_URL}/signage/device/${device.id}/deployments`, {
      headers: { Authorization: `Bearer ${deviceToken}` },
    });
    expect(pullNormal.ok()).toBeTruthy();
    const dataNormal = await pullNormal.json();
    expect(dataNormal.some((d) => d.post_id === postId)).toBeTruthy();

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

    seedVideoPost(me.group_id, me.id, `Video Post ${ts}`);

    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");

    await page.locator('label:has-text("Post") + select').selectOption((await page.locator('label:has-text("Post") + select option').filter({ hasText: `Video Post ${ts}` }).first().getAttribute("value")));

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

    const imagePath = mockImagePath();
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

    await page.goto("/creator/signage");
    await page.waitForLoadState("networkidle");
    await page.locator('label:has-text("Post") + select').selectOption(String(postId));
    await page.locator('label:has-text("Target Display") + select').selectOption(String(device.id));
    await page.click('button:has-text("Publish to Display")');

    await expect(page.locator(`text=❌ Update cancelled. These displays are offline: Offline Display ${ts}`)).toBeVisible({ timeout: 10000 });
  });
});
