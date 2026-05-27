import { test, expect } from "@playwright/test";
import { resetState, loginTestAdmin, API_URL } from "../helpers/test-helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Admin Group tests", () => {
  let adminToken;

  test.beforeEach(async ({ request }) => {
    await resetState(request);
    adminToken = await loginTestAdmin(request);
  });

  test("create multiple groups with different scenarios", async ({ page, request }) => {
    const ts = Date.now();

    await page.goto("/login");
    await page.fill('input[name="username"]', "test-admin");
    await page.fill('input[name="password"]', "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin", { timeout: 5000 });

    await page.goto("/admin/groups");
    await expect(page.locator('h1:has-text("Groups")')).toBeVisible();
    await page.waitForLoadState("networkidle");

    const rows = page.locator('table tbody tr');
    const baselineCount = await rows.count();

    const getFormValues = async () =>
      page.evaluate(() => ({
        name: document.querySelector('input[required]')?.value || "",
        description: document.querySelector('textarea')?.value || "",
      }));

    await page.fill('label:has-text("Name") + input, input[required]:near(label:text("Name"))', `Normal-Group-${ts}`);
    await page.fill('label:has-text("Description") + textarea', "A normal group for everyday content");
    await page.click('button:has-text("Create")');
    await expect(page.locator(`text=Normal-Group-${ts}`)).toBeVisible();
    const formAfterCreate1 = await getFormValues();
    expect(formAfterCreate1.name).toBe("");

    await page.fill('label:has-text("Name") + input, input[required]:near(label:text("Name"))', `Emergency-Group-${ts}`);
    await page.fill('label:has-text("Description") + textarea', "Critical alerts and emergency broadcasts");
    await page.selectOption('label:has-text("Display mode") + select, select:near(label:text("Display mode"))', "EMERGENCY");
    await page.click('button:has-text("Create")');
    await expect(page.locator(`text=Emergency-Group-${ts}`)).toBeVisible();

    await page.fill('label:has-text("Name") + input, input[required]:near(label:text("Name"))', `Security-Group-${ts}`);
    await page.fill('label:has-text("Description") + textarea', "");
    await page.selectOption('label:has-text("Display mode") + select, select:near(label:text("Display mode"))', "SECURITY_RISK");
    await page.click('button:has-text("Create")');
    await expect(page.locator(`text=Security-Group-${ts}`)).toBeVisible();

    await page.fill('label:has-text("Name") + input, input[required]:near(label:text("Name"))', `Breaking-Group-${ts}`);
    await page.fill('label:has-text("Description") + textarea', "Live updates and breaking news");
    await page.selectOption('label:has-text("Display mode") + select, select:near(label:text("Display mode"))', "BREAKING_NEWS");
    await page.click('button:has-text("Create")');
    await expect(page.locator(`text=Breaking-Group-${ts}`)).toBeVisible();

    await expect(page.locator(`tr:has-text("Normal-Group-${ts}"):has-text("Normal")`)).toBeVisible();
    await expect(page.locator(`tr:has-text("Emergency-Group-${ts}"):has-text("Emergency")`)).toBeVisible();
    await expect(page.locator(`tr:has-text("Security-Group-${ts}"):has-text("Security & Risk")`)).toBeVisible();
    await expect(page.locator(`tr:has-text("Breaking-Group-${ts}"):has-text("Breaking News")`)).toBeVisible();

    await expect(page.locator(`tr:has-text("Normal-Group-${ts}"):has-text("A normal group for everyday content")`)).toBeVisible();
    await expect(page.locator(`tr:has-text("Emergency-Group-${ts}"):has-text("Critical alerts and emergency broadcasts")`)).toBeVisible();
    await expect(page.locator(`tr:has-text("Security-Group-${ts}"):has-text("No description")`)).toBeVisible();

    await page.fill('label:has-text("Name") + input, input[required]:near(label:text("Name"))', `Normal-Group-${ts}`);
    await page.fill('label:has-text("Description") + textarea', "Duplicate attempt");
    await page.click('button:has-text("Create")');
    const formAfterDup = await getFormValues();
    expect(formAfterDup.name).toBe(`Normal-Group-${ts}`);
    const dupCount = await rows.count();
    expect(dupCount).toBe(baselineCount + 4);

    const token = await page.evaluate(() => localStorage.getItem("token"));
    const dupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `Normal-Group-${ts}`, description: "API dup" },
    });
    expect(dupRes.status()).toBe(400);
    const dupBody = await dupRes.json();
    expect(dupBody.error).toBe("Group name already exists.");

    const normalRow = page.locator(`tr:has-text("Normal-Group-${ts}")`);
    const stateSelect = normalRow.locator('select');
    await stateSelect.selectOption("EMERGENCY");
    await expect(page.locator(`tr:has-text("Normal-Group-${ts}"):has-text("Emergency")`)).toBeVisible();

    const securityRow = page.locator(`tr:has-text("Security-Group-${ts}")`);
    page.on('dialog', async (dialog) => await dialog.accept());
    await securityRow.locator('button:has-text("Delete")').click();
    await expect(securityRow).not.toBeVisible();

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

  test("Device refresh side-effect when signage_state changes", async ({ request }) => {
    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `RefreshGroup-${Date.now()}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    const grp = await groupRes.json();

    const regRes = await request.post(`${API_URL}/devices/register`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { device_name: "Refresh Pi", ip_address: "192.168.1.200", group_id: grp.id },
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

    const updateRes = await request.put(`${API_URL}/groups/${grp.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { signage_state: "BREAKING_NEWS" },
    });
    expect(updateRes.ok()).toBeTruthy();

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
  });

  test("Managed groups visibility — creator only sees assigned groups", async ({ request }) => {
    const ts = Date.now();

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

    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: { username: `creator-visibility-${ts}`, password: "TestPass123!" },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    const creatorToken = loginData.token;

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
  });

  test("Delete protection — cannot delete a group that has an active post", async ({ request }) => {
    const ts = Date.now();

    const groupRes = await request.post(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { name: `ProtectedGroup-${ts}` },
    });
    expect(groupRes.ok()).toBeTruthy();
    const grp = await groupRes.json();

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

    const delRes = await request.delete(`${API_URL}/groups/${grp.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(delRes.status()).toBe(400);
    const body = await delRes.json();
    expect(body.error).toMatch(/still used/i);

    const listRes = await request.get(`${API_URL}/groups`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const groups = await listRes.json();
    expect(groups.some((g) => g.id === grp.id)).toBe(true);
  });
});
