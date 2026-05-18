import { test, expect } from "@playwright/test";

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
