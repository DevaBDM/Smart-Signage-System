import { test, expect } from "@playwright/test";
import fs from "fs";
import {
  resetState,
  loginTestAdmin,
  loginAs,
  loginViaApi,
  API_URL,
  mockImagePath,
  seedSignageDeployment,
} from "../helpers/test-helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Post API tests", () => {
  let adminToken;
  let creatorToken;

  test.beforeEach(async ({ request }) => {
    await resetState(request);
    adminToken = await loginTestAdmin(request);

    const creatorLogin = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    expect(creatorLogin.ok()).toBeTruthy();
    const creatorData = await creatorLogin.json();
    creatorToken = creatorData.token;
  });

  test("create a post via API", async ({ request }) => {
    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `TestGroup-${Date.now()}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    const group = await groupRes.json();

    const postRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
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

  test("edit post with image does not delete the image file", async ({ request }) => {
    const ts = Date.now();

    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `ImgGroup-${ts}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    const group = await groupRes.json();

    const mockImage = mockImagePath();

    // 1. Create a post with an image
    const createRes = await request.post(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      multipart: {
        title: `Image Post ${ts}`,
        group_ids: JSON.stringify([group.id]),
        status: "published",
        allowed_on_signage: "true",
        images: { name: "test.png", mimeType: "image/png", buffer: fs.readFileSync(mockImage) },
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createData = await createRes.json();
    const postId = createData.posts[0].id;
    const imagePath = createData.posts[0].images[0].image_path;

    // 2. Verify image is initially reachable
    const initialImage = await request.get(`http://localhost:5001${imagePath}`);
    expect(initialImage.ok()).toBeTruthy();

    // 3. Edit the post — toggle signage OFF then back ON (simulating the bug trigger)
    const processedMedia = JSON.stringify(createData.posts[0].images.map((img, i) => ({
      image_path: img.image_path,
      media_type: img.media_type,
      duration_seconds: img.duration_seconds,
      order_index: i,
    })));

    const updateRes = await request.put(`${API_URL}/posts/${postId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      multipart: {
        title: `Image Post ${ts}`,
        processed_media: processedMedia,
        allowed_on_signage: "false",
      },
    });
    expect(updateRes.ok()).toBeTruthy();

    // 4. Toggle back to signage ON
    const updateRes2 = await request.put(`${API_URL}/posts/${postId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      multipart: {
        title: `Image Post ${ts}`,
        processed_media: processedMedia,
        allowed_on_signage: "true",
      },
    });
    expect(updateRes2.ok()).toBeTruthy();

    // 5. Verify the image file is STILL reachable (regression check)
    const finalImage = await request.get(`http://localhost:5001${imagePath}`);
    expect(finalImage.ok()).toBeTruthy();

    // 6. Verify DB still has the image record
    const getRes = await request.get(`${API_URL}/posts/${postId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.ok()).toBeTruthy();
    const post = await getRes.json();
    expect(post.images.length).toBe(1);
    expect(post.images[0].image_path).toBe(imagePath);
  });

  test("1. Admin global visibility — sees posts from all groups regardless of own group_id", async ({ request }) => {
    const ts = Date.now();

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

    const gRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `ApprovalGroup-${ts}` },
    });
    expect(gRes.ok()).toBeTruthy();
    const group = await gRes.json();

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

    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: `approval-creator-${ts}`, password: "TestPass123!" },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    const freshCreatorToken = loginData.token;

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

    const reqRes = await request.post(`${API_URL}/posts/bulk-action`, {
      headers: { Authorization: `Bearer ${freshCreatorToken}` },
      data: { ids: [postId], action: "add-feed" },
    });
    expect(reqRes.ok()).toBeTruthy();

    const getRes = await request.get(`${API_URL}/posts/${postId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.ok()).toBeTruthy();
    const before = await getRes.json();
    expect(before.requested_feed).toBe(true);
    expect(before.allowed_on_feed).toBe(false);

    const putRes = await request.put(`${API_URL}/posts/${postId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      multipart: {
        allowed_on_feed: "true",
      },
    });
    expect(putRes.ok()).toBeTruthy();

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

    const bulkRes = await request.post(`${API_URL}/posts/bulk-action`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { ids: posts, action: "delete" },
    });
    expect(bulkRes.ok()).toBeTruthy();
    const bulkBody = await bulkRes.json();
    expect(bulkBody.ok).toBe(true);

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

    const gRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `SignageRem-${ts}` },
    });
    expect(gRes.ok()).toBeTruthy();
    const group = await gRes.json();

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

    seedSignageDeployment(postId, device.id);

    await request.post(`${API_URL}/test/bridge-calls/clear`).catch(() => {});

    const delRes = await request.delete(`${API_URL}/posts/${postId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(delRes.ok()).toBeTruthy();

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

test.describe("Admin Posts UI tests", () => {
  test.beforeEach(async ({ request }) => {
    await resetState(request);
  });

  test("manage posts from admin dashboard", async ({ page, request }) => {
    const ts = Date.now();

    await page.goto("/login");
    await page.fill('input[name="username"]', "test-admin");
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin", { timeout: 5000 });

    const token = await page.evaluate(() => localStorage.getItem("token"));

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

    await page.goto("/admin/posts");
    await expect(page.locator('h1:has-text("All Posts")')).toBeVisible();
    await page.waitForLoadState("networkidle");

    const postRow = page.locator(`tr:has-text("Dashboard Post ${ts}")`);
    await expect(postRow).toBeVisible();
    await expect(postRow.locator('text=published')).toBeVisible();
    await expect(postRow.locator('td').nth(3).locator('text=⬜')).toBeVisible();
    await expect(postRow.locator('td').nth(4).locator('text=⬜')).toBeVisible();

    const feedCell = postRow.locator('td').nth(3);
    await feedCell.click();
    await expect(feedCell.locator('text=✅')).toBeVisible();

    const signageCell = postRow.locator('td').nth(4);
    await signageCell.click();
    await expect(signageCell.locator('text=✅')).toBeVisible();

    const getRes = await request.get(`${API_URL}/posts/${postId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.ok()).toBeTruthy();
    const apiPost = await getRes.json();
    expect(apiPost.allowed_on_feed).toBe(true);
    expect(apiPost.allowed_on_signage).toBe(true);

    page.on('dialog', async (dialog) => await dialog.accept());
    await postRow.locator('button:has-text("Delete")').click();
    await expect(postRow).not.toBeVisible();

    const listRes = await request.get(`${API_URL}/posts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const posts = await listRes.json();
    expect(posts.some((p) => p.id === postId)).toBe(false);
  });
});

test.describe("Creator My Posts UI tests", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetState(request);
    await loginAs(page, "test-creator", "TestPass123!");
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

    await page.locator('label:has-text("Title") + input').fill(`UI Post ${ts}`);
    await page.locator('label:has-text("Description") + textarea').fill("Test description from UI");

    const mockImage = mockImagePath();
    await page.locator('input[type="file"]').setInputFiles(mockImage);

    await expect(page.locator('h3:has-text("Crop image")')).toBeVisible();
    await page.click('button:has-text("Apply crop")');
    await expect(page.locator('h3:has-text("Crop image")')).not.toBeVisible();

    await page.getByLabel("Publish to Feed").check();

    await page.locator('label:has-text("Post Status") + select').selectOption("published");

    await page.click('button:has-text("Save Post")');

    await expect(page.locator(`text=UI Post ${ts}`)).toBeVisible();
    await expect(page.locator('h2:has-text("Posts (1)")')).toBeVisible();
  });

  test("3. Creator can edit a post via UI", async ({ page, request }) => {
    const ts = Date.now();

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

    await page.goto("/creator/posts");
    await page.waitForLoadState("networkidle");

    await page.getByTitle("Edit post").first().click();

    await expect(page.locator('h2:has-text("Edit Post")')).toBeVisible();

    await page.locator('label:has-text("Title") + input').fill(`Updated Title ${ts}`);

    await page.click('button:has-text("Update Post")');

    await expect(page.locator(`text=Updated Title ${ts}`)).toBeVisible();
  });

  test("4. Creator can delete a post via UI", async ({ page, request }) => {
    const ts = Date.now();

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

    await page.goto("/creator/posts");
    await page.waitForLoadState("networkidle");

    page.on('dialog', async dialog => {
      if (dialog.type() === 'confirm') await dialog.accept();
    });

    await page.getByTitle("Delete post").first().click();

    await expect(page.locator(`text=Delete Target ${ts}`)).not.toBeVisible();
    await expect(page.locator('h2:has-text("Posts (0)")')).toBeVisible();
  });

  test("5. Creator can filter posts by channel", async ({ page, request }) => {
    const ts = Date.now();

    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    const { token: creatorToken } = await loginRes.json();

    const meRes = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    const me = await meRes.json();

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

    await page.goto("/creator/posts");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(`text=Feed Post ${ts}`)).toBeVisible();
    await expect(page.locator(`text=Signage Post ${ts}`)).toBeVisible();

    const feedPromise = page.waitForResponse(resp => resp.url().includes("/api/posts") && resp.status() === 200);
    await page.locator('label:has-text("Type") select').selectOption("feed");
    await feedPromise;

    await expect(page.locator(`text=Feed Post ${ts}`)).toBeVisible();
    await expect(page.locator(`text=Signage Post ${ts}`)).not.toBeVisible();

    const signPromise = page.waitForResponse(resp => resp.url().includes("/api/posts") && resp.status() === 200);
    await page.locator('label:has-text("Type") select').selectOption("signage");
    await signPromise;

    await expect(page.locator(`text=Feed Post ${ts}`)).not.toBeVisible();
    await expect(page.locator(`text=Signage Post ${ts}`)).toBeVisible();

    const allPromise = page.waitForResponse(resp => resp.url().includes("/api/posts") && resp.status() === 200);
    await page.locator('label:has-text("Type") select').selectOption("all");
    await allPromise;

    await expect(page.locator(`text=Feed Post ${ts}`)).toBeVisible();
    await expect(page.locator(`text=Signage Post ${ts}`)).toBeVisible();
  });

  test("6. Creator can select all and bulk delete posts", async ({ page, request }) => {
    const ts = Date.now();

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

    await page.goto("/creator/posts");
    await page.waitForLoadState("networkidle");

    for (let i = 1; i <= 3; i++) {
      await expect(page.locator(`text=Bulk Post ${i} ${ts}`)).toBeVisible();
    }

    await page.click('button:has-text("Select Mine")');

    await expect(page.locator('text=3 items selected')).toBeVisible();

    page.on('dialog', async dialog => {
      if (dialog.type() === 'confirm') await dialog.accept();
    });

    await page.click('button:has-text("🗑 Delete")');

    for (let i = 1; i <= 3; i++) {
      await expect(page.locator(`text=Bulk Post ${i} ${ts}`)).not.toBeVisible();
    }
    await expect(page.locator('h2:has-text("Posts (0)")')).toBeVisible();
  });

  test("7. Horizontal isolation — other creator's post is view-only", async ({ page, request }) => {
    const ts = Date.now();

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

    await loginViaApi(page, request, `creator-b-${ts}`, "TestPass123!");
    await page.goto("/creator/posts", { waitUntil: "networkidle" });
    await page.waitForLoadState("networkidle");

    await expect(page.locator(`text=A Secret Post ${ts}`)).toBeVisible();
    await expect(page.locator('text=view only')).toBeVisible();

    const editBtn = page.getByTitle("Admin approval is required to edit this post").first();
    const delBtn = page.getByTitle("Admin approval is required to delete this post").first();
    await expect(editBtn).toBeDisabled();
    await expect(delBtn).toBeDisabled();

    const checkbox = page.locator('input[type="checkbox"][title^="Admin approval"]').first();
    await expect(checkbox).toBeDisabled();
  });

  test("8. Validation — missing media blocks save", async ({ page }) => {
    await page.goto("/creator/posts");
    await page.waitForLoadState("networkidle");

    await page.locator('label:has-text("Title") + input').fill("No Media Post");
    await page.locator('label:has-text("Description") + textarea').fill("This post has no media");

    await page.click('button:has-text("Save Post")');

    await expect(page.locator('text=❌ Add at least one image or video.')).toBeVisible();

    await expect(page.locator('text=No Media Post')).not.toBeVisible();
  });

  test("9. Bulk action guardrail — + Signage without displays triggers alert", async ({ page, request }) => {
    const ts = Date.now();

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

    await page.goto("/creator/posts");
    await page.waitForLoadState("networkidle");

    await page.click('button:has-text("Select Mine")');
    await expect(page.locator('text=1 items selected')).toBeVisible();

    let alertMessage = "";
    page.on("dialog", async (dialog) => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await page.click('button:has-text("+ Signage")');

    expect(alertMessage).toContain("select at least one display");
  });

  test("10. Filter by Creator dropdown shows only selected creator's posts", async ({ page, request }) => {
    const ts = Date.now();

    const adminToken = await loginTestAdmin(request);
    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `CreatorFilterGroup-${ts}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    const group = await groupRes.json();

    const regA = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `cf-creator-a-${ts}`, password: "TestPass123!", role: "creator", auto_approve: true, group_id: group.id, managed_group_ids: JSON.stringify([group.id]) },
    });
    expect(regA.ok()).toBeTruthy();
    const userA = await regA.json();

    const regB = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `cf-creator-b-${ts}`, password: "TestPass123!", role: "creator", auto_approve: true, group_id: group.id, managed_group_ids: JSON.stringify([group.id]) },
    });
    expect(regB.ok()).toBeTruthy();
    const userB = await regB.json();

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

    await loginViaApi(page, request, `cf-creator-a-${ts}`, "TestPass123!");
    await page.goto("/creator/posts", { waitUntil: "domcontentloaded" });
    await page.waitForSelector('text=My Posts', { timeout: 10000 });

    await expect(page.locator(`text=Post By A ${ts}`)).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`text=Post By B ${ts}`)).toBeVisible({ timeout: 5000 });

    const creatorSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'All creators in group' }) });

    await creatorSelect.selectOption(String(userA.id));
    await page.waitForResponse((resp) => resp.url().includes("/api/posts") && resp.status() === 200);

    await expect(page.locator(`text=Post By A ${ts}`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=Post By B ${ts}`)).not.toBeVisible();

    await creatorSelect.selectOption(String(userB.id));
    await page.waitForResponse((resp) => resp.url().includes("/api/posts") && resp.status() === 200);

    await expect(page.locator(`text=Post By A ${ts}`)).not.toBeVisible();
    await expect(page.locator(`text=Post By B ${ts}`)).toBeVisible({ timeout: 10000 });
  });
});
