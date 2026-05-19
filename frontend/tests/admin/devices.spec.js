import { test, expect } from "@playwright/test";
import { resetState, loginTestAdmin, API_URL, createPendingDevice } from "../helpers/test-helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Device lifecycle API tests", () => {
  let adminToken;
  let creatorToken;
  let group;
  let deviceId;

  test.beforeEach(async ({ request }) => {
    await resetState(request);
    adminToken = await loginTestAdmin(request);

    const creatorLogin = await request.post(`${API_URL}/auth/login`, {
      data: { username: "test-creator", password: "TestPass123!" },
    });
    expect(creatorLogin.ok()).toBeTruthy();
    const creatorData = await creatorLogin.json();
    creatorToken = creatorData.token;

    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `DeviceTestGroup-${Date.now()}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    group = await groupRes.json();
  });

  test("1. Approval flow — pending device becomes active", async ({ request }) => {
    const { id } = createPendingDevice(group.id);
    deviceId = id;

    const getRes = await request.get(`${API_URL}/devices/${deviceId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.ok()).toBeTruthy();
    const before = await getRes.json();
    expect(before.is_approved).toBe(false);
    expect(before.pending_name).toBe("Lab-Pi-01");
    expect(before.pending_ip).toBe("192.168.1.50");

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

    const getRes = await request.get(`${API_URL}/devices/${dev.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.ok()).toBeTruthy();
    const device = await getRes.json();
    expect(device.location).toBe("Science Wing, Room 302");
    expect(device.all_groups).toBe(true);
  });

  test("3. Cleanup flow — secure deletion with clear_all", async ({ request }) => {
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

    const deleteRes = await request.delete(`${API_URL}/devices/${dev.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(deleteRes.ok()).toBeTruthy();
    const delBody = await deleteRes.json();
    expect(delBody.ok).toBe(true);

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

    const getRes = await request.get(`${API_URL}/devices/${dev.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.status()).toBe(404);
  });

  test("4. Security flow — RBAC enforcement", async ({ request }) => {
    const { id: rbacDeviceId } = createPendingDevice(group.id);

    const approveRes = await request.post(`${API_URL}/devices/${rbacDeviceId}/approve`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
      data: { group_id: group.id },
    });
    expect(approveRes.status()).toBe(403);

    const deleteRes = await request.delete(`${API_URL}/devices/${rbacDeviceId}`, {
      headers: { Authorization: `Bearer ${creatorToken}` },
    });
    expect(deleteRes.status()).toBe(403);
  });

  test("5. Reset flow — factory reset simulation", async ({ request }) => {
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

    const sensorRes = await request.get(`${API_URL}/sensors/${device.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(sensorRes.ok()).toBeTruthy();
    const sensorLogs = await sensorRes.json();
    expect(sensorLogs).toBeInstanceOf(Array);
    expect(sensorLogs.length).toBeGreaterThan(0);
  });
});
