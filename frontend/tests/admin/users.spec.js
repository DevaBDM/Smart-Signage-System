import { test, expect } from "@playwright/test";
import { resetState, loginTestAdmin, API_URL } from "../helpers/test-helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("User lifecycle API tests", () => {
  let adminToken;
  let creatorToken;
  let groupA;
  let groupB;

  test.beforeEach(async ({ request }) => {
    await resetState(request);
    adminToken = await loginTestAdmin(request);

    const creatorLogin = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    expect(creatorLogin.ok()).toBeTruthy();
    const creatorData = await creatorLogin.json();
    creatorToken = creatorData.token;

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
    const listRes = await request.get(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    expect(listRes.status()).toBe(403);

    const regRes = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { username: `rbac-target-${ts}`, password: "TestPass123!", role: "viewer" },
    });
    expect(regRes.ok()).toBeTruthy();
    const target = await regRes.json();

    const putRes = await request.put(`${API_URL}/users/${target.id}`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      data: { role: "admin" },
    });
    expect(putRes.status()).toBe(403);

    const delRes = await request.delete(`${API_URL}/users/${target.id}`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    expect(delRes.status()).toBe(403);

    const reg2 = await request.post(`${API_URL}/auth/register`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      data: { username: `rbac-new-${ts}`, password: "TestPass123!", role: "creator" },
    });
    expect(reg2.status()).toBe(403);
  });

  test("4. Admin cannot delete their own account", async ({ request }) => {
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

    const listRes = await request.get(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const users = await listRes.json();
    expect(users.some((u) => u.username === `delete-me-${ts}`)).toBe(false);
  });

  test("6. Priority swap — two creators exchange priorities via API", async ({ request }) => {
    const ts = Date.now();

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

    const swapRes = await request.put(`${API_URL}/users/${userB.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { creator_priority: prioA },
    });
    expect(swapRes.ok()).toBeTruthy();
    const afterB = await swapRes.json();
    expect(afterB.creator_priority).toBe(prioA);

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

    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: `drilldown-creator-${ts}`, password: "TestPass123!" },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    const userToken = loginData.token;

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
