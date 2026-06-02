import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { expect } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const API_URL = "http://localhost:5001/api";

/** Login with the test admin account. Creates it via first-user registration if needed. */
export async function loginTestAdmin(request) {
  const username = "test-admin";
  const password = "TestPass123!";

  const login = await request.post(`${API_URL}/auth/login`, {
    data: { username, password },
  });
  if (login.ok()) {
    const json = await login.json();
    expect(json.token, "Login response should contain token").toBeDefined();
    return json.token;
  }

  const reg = await request.post(`${API_URL}/auth/register`, {
    data: { username, password, role: "admin" },
  });
  expect(reg.ok(), "First-user registration should succeed").toBeTruthy();

  const afterReg = await request.post(`${API_URL}/auth/login`, {
    data: { username, password },
  });
  expect(afterReg.ok(), "Login after registration should succeed").toBeTruthy();
  const json = await afterReg.json();
  expect(json.token, "Login response should contain token").toBeDefined();
  return json.token;
}

export async function resetState(request) {
  const res = await request.post(`${API_URL}/test/reset`);
  expect(res.ok(), "Reset endpoint should succeed").toBeTruthy();
}

export async function loginAs(page, username, password, redirectPattern = "**/creator") {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("group_id");
    localStorage.removeItem("max_signage_state");
    localStorage.removeItem("managed_group_ids");
  });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[name="username"]', { timeout: 20000 });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(redirectPattern, { timeout: 15000 });
}

/**
 * Quick-login via API: set token in localStorage.
 * Navigates to /feed first (required to establish an origin for localStorage access),
 * clears existing state, sets the new auth token and role, then stops.
 * The caller should navigate to the target page (e.g., page.goto("/creator/posts"))
 * which forces a full page reload and causes Zustand to re-read localStorage.
 */
export async function loginViaApi(page, request, username, password) {
  const loginRes = await request.post(`${API_URL}/auth/login`, {
    data: { username, password },
  });
  if (!loginRes.ok()) throw new Error(`Login failed for ${username}`);
  const { token, role, group_id, max_signage_state, managed_group_ids } = await loginRes.json();
  // Navigate to the app origin first, then set localStorage
  await page.goto("/feed", { waitUntil: "domcontentloaded" });
  await page.evaluate(({ token, role, group_id, max_signage_state, managed_group_ids }) => {
    localStorage.clear();
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("group_id", group_id ?? "");
    localStorage.setItem("max_signage_state", max_signage_state || "NORMAL");
    localStorage.setItem("managed_group_ids", JSON.stringify(managed_group_ids || []));
  }, { token, role, group_id, max_signage_state, managed_group_ids });
}

export function seedSignageAsset(postId, deviceId, assetId) {
  const script = path.resolve(__dirname, "../../../backend/scripts/seedSignageAsset.js");
  execSync(`node "${script}" ${postId} ${deviceId} "${assetId}"`, {
    cwd: path.resolve(__dirname, "../../../backend"),
    encoding: "utf-8",
  });
}

export function seedVideoPost(groupId, creatorId, title) {
  const script = path.resolve(__dirname, "../../../backend/scripts/seedVideoPost.js");
  execSync(`node "${script}" ${groupId} ${creatorId} "${title}"`, {
    cwd: path.resolve(__dirname, "../../../backend"),
    encoding: "utf-8",
  });
}

export function seedSignageDeployment(postId, deviceId) {
  const script = path.resolve(__dirname, "../../../backend/scripts/seedSignageDeployment.js");
  execSync(`node "${script}" ${postId} ${deviceId}`, {
    cwd: path.resolve(__dirname, "../../../backend"),
    encoding: "utf-8",
  });
}

export function createPendingDevice(groupId) {
  const script = path.resolve(__dirname, "../../../backend/scripts/createPendingDevice.js");
  const out = execSync(`node "${script}" ${groupId}`, { encoding: "utf-8" });
  const jsonLine = out.trim().split(/\r?\n/).filter((l) => l.trim().startsWith("{")).pop();
  return JSON.parse(jsonLine);
}

export function mockImagePath() {
  return path.resolve(__dirname, "../MockMedia/Images/pexels-pixabay-267507.jpg");
}

export function miniPngBuffer() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}
