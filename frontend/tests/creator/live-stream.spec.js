import { test, expect } from "@playwright/test";
import {
  resetState,
  loginAs,
  API_URL,
} from "../helpers/test-helpers.js";

const TEST_HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

async function getCreatorTokenAndGroup(request) {
  const loginRes = await request.post(`${API_URL}/auth/login`, {
    data: { username: "test-creator", password: "TestPass123!" },
  });
  const { token } = await loginRes.json();

  const meRes = await request.get(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const me = await meRes.json();
  return { token, groupId: me.group_id };
}

test.describe.configure({ mode: "serial" });

test.describe("Creator Live Stream UI tests", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetState(request);
    await loginAs(page, "test-creator", "TestPass123!");
  });

  test("1. Creator sees created stream in Live Streams UI and can delete it", async ({ page, request }) => {
    const { token, groupId } = await getCreatorTokenAndGroup(request);

    const streamRes = await request.post(`${API_URL}/live-streams`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: "Test HLS Stream",
        stream_type: "HLS",
        source_url: TEST_HLS,
        group_id: groupId,
      },
    });
    expect(streamRes.ok()).toBeTruthy();

    await page.goto("/creator/live-streams");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('h1:has-text("Live Streams")')).toBeVisible();
    await expect(page.locator('text=Test HLS Stream')).toBeVisible();
    // HLS type badge in the stream list row (narrow to span to avoid select option)
    await expect(page.locator('span:has-text("HLS")').first()).toBeVisible();

    // Delete via UI
    page.on("dialog", async (dialog) => await dialog.accept());
    await page.click('button:has-text("Delete")');
    await expect(page.locator('text=Test HLS Stream')).not.toBeVisible();
  });

  test("2. Creator can attach a live stream to a post and publish to feed", async ({ page, request }) => {
    const { token, groupId } = await getCreatorTokenAndGroup(request);

    const streamRes = await request.post(`${API_URL}/live-streams`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: "Feed Live Stream",
        stream_type: "HLS",
        source_url: TEST_HLS,
        group_id: groupId,
      },
    });
    expect(streamRes.ok()).toBeTruthy();
    const stream = await streamRes.json();

    await page.goto("/creator/posts");
    await page.waitForLoadState("networkidle");

    const ts = Date.now();
    await page.locator('label:has-text("Title") + input').fill(`Live Post ${ts}`);
    await page.locator('label:has-text("Description") + textarea').fill("Live stream test post");

    // Switch to live stream mode
    await page.getByLabel("Use live stream").check();

    // Select the stream from dropdown
    await page.locator('select').filter({ hasText: /Select a live stream/ }).selectOption(String(stream.id));

    await page.getByLabel("Publish to Feed").check();
    await page.locator('label:has-text("Post Status") + select').selectOption("published");

    await page.click('button:has-text("Save Post")');

    // Should see the post in the list with LIVE badge
    await expect(page.locator(`text=Live Post ${ts}`)).toBeVisible();
    await expect(page.locator('span:has-text("LIVE")')).toBeVisible();

    // Verify in public feed
    await page.goto("/feed");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(`h2:has-text("Live Post ${ts}")`)).toBeVisible();
  });
});
