import { test, expect } from "@playwright/test";
import { resetState, loginTestAdmin, API_URL } from "./helpers/test-helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Auth & RBAC tests", () => {
  test.beforeEach(async ({ request }) => {
    await resetState(request);
  });

  test("login via frontend form succeeds", async ({ page }) => {
    const username = "test-admin";
    const password = "TestPass123!";

    await page.goto("/login");
    await expect(page.locator('h1:has-text("Smart Signage")')).toBeVisible();

    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await page.waitForURL("**/admin", { timeout: 5000 });

    await expect(page.locator("text=Invalid username or password.")).not.toBeVisible();

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

    await expect(page.locator('h1:has-text("Admin Dashboard")')).toBeVisible();

    await page.goto("/login");
    await page.waitForURL("**/admin", { timeout: 5000 });
  });
});
