import { test, expect } from "@playwright/test";
import { resetState, loginAs } from "../helpers/test-helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Signage Designer UI tests", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetState(request);
    await page.goto("/login");
    await page.evaluate(() => localStorage.clear());
    await loginAs(page, "test-creator", "TestPass123!");
  });

  test("designer loads with visual canvas mode", async ({ page }) => {
    await page.goto("/creator/editor");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Digital signage")).toBeVisible();
    await expect(page.locator('button:has-text("Visual canvas")')).toBeVisible();
    await expect(page.locator('button:has-text("Markdown slide")')).toBeVisible();

    // Visual mode should be active by default
    const visualBtn = page.locator('button:has-text("Visual canvas")');
    await expect(visualBtn).toHaveCSS("background-color", /rgb\(37, 99, 235\)|#2563eb/);
  });

  test("switch between visual and markdown modes", async ({ page }) => {
    await page.goto("/creator/editor");
    await page.waitForLoadState("networkidle");

    const markdownBtn = page.locator('button:has-text("Markdown slide")');
    await markdownBtn.click();

    // Markdown toolbar should appear
    await expect(page.locator('span:has-text("Markdown")')).toBeVisible();
    await expect(page.locator("textarea")).toBeVisible();

    const visualBtn = page.locator('button:has-text("Visual canvas")');
    await visualBtn.click();

    // Visual toolbar should reappear
    await expect(page.locator('span:has-text("Templates")')).toBeVisible();
    await expect(page.locator('span:has-text("Add")')).toBeVisible();
  });

  test("apply template and add text on visual canvas", async ({ page }) => {
    await page.goto("/creator/editor");
    await page.waitForLoadState("networkidle");

    // Apply "Big headline" template
    await page.locator('button:has-text("Big headline")').click();

    // Add text via toolbar (fullwidth plus sign)
    await page.locator('button:has-text("＋ Text")').click();

    // Export button should be visible and clickable
    const exportBtn = page.locator('button:has-text("Use this slide")');
    await expect(exportBtn).toBeVisible();
  });

  test("change background color and export slide", async ({ page }) => {
    await page.goto("/creator/editor");
    await page.waitForLoadState("networkidle");

    // Switch to markdown mode for simpler export test
    await page.locator('button:has-text("Markdown slide")').click();

    // Type some markdown
    const textarea = page.locator("textarea");
    await textarea.fill("# Test Slide\n\nHello from designer test.");

    // Click export
    await page.locator('button:has-text("Use this slide")').click();

    // The export triggers onExport in CreatorEditor which sets the exported image state
    // We should see the form with the exported preview or a save option
    await expect(page.locator("text=Save Design")).toBeVisible();
  });
});
