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
  await page.goto("/login");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(redirectPattern, { timeout: 5000 });
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
