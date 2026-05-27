import { test, expect } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { loginAs } from "./helpers/test-helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.resolve(__dirname, "../docs/auto-generated");

function shot(name) {
  return path.join(SCREENSHOT_DIR, name);
}

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  if (process.env.DOC_SEED === "1") {
    const seedScript = path.resolve(__dirname, "doc-fixtures/seed.js");
    try {
      execSync(`node "${seedScript}"`, { stdio: "inherit" });
    } catch (e) {
      console.warn("⚠ seed step failed; continuing with existing DB content");
    }
  }
});

test.describe.configure({ mode: "serial" });

test.describe("Step-by-step manual screenshot generation", () => {
  /* ═══════════════════════════════════════════════════════════════
     1. LOGIN FLOW
     ═══════════════════════════════════════════════════════════════ */
  test("1. Login flow — empty form → filled → admin dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("01a-login-empty.png") });

    await page.fill('input[name="username"]', "test-admin");
    await page.fill('input[name="password"]', "TestPass123!");
    await page.screenshot({ path: shot("01b-login-filled.png") });

    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin", { timeout: 5000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("01c-admin-dashboard.png") });
  });

  /* ═══════════════════════════════════════════════════════════════
     2. ADMIN — GROUPS (list → create form → created)
     ═══════════════════════════════════════════════════════════════ */
  test("2. Admin groups — step-by-step creation", async ({ page }) => {
    await loginAs(page, "test-admin", "TestPass123!", "**/admin");
    await page.goto("/admin/groups");
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("02a-groups-list.png") });

    // Fill the Add Group form
    await page.locator('div:has(> h2:has-text("Add Group")) input').first().fill("Research Center");
    await page.locator('div:has(> h2:has-text("Add Group")) textarea').first().fill("Interdisciplinary research announcements and lab bookings.");
    await page.screenshot({ path: shot("02b-groups-form-filled.png") });

    await page.locator('div:has(> h2:has-text("Add Group")) button[type="submit"]').click();
    await page.waitForTimeout(600);
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("02c-groups-created.png") });
  });

  /* ═══════════════════════════════════════════════════════════════
     3. ADMIN — USERS (list → create form → created)
     ═══════════════════════════════════════════════════════════════ */
  test("3. Admin users — step-by-step registration", async ({ page }) => {
    await loginAs(page, "test-admin", "TestPass123!", "**/admin");
    await page.goto("/admin/users");
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("03a-users-list.png") });

    // Fill the Add User form (left card)
    const card = page.locator('div:has(> h2:has-text("Add User"))');
    await card.locator('input').nth(0).fill("research.director");
    await card.locator('input[type="password"]').fill("CreatorPass123!");
    await card.locator('select').nth(0).selectOption("creator");
    // Primary group — pick first available group
    const groupSelect = card.locator('select').nth(1);
    const groupOptions = await groupSelect.locator('option').allTextContents();
    if (groupOptions.length > 1) await groupSelect.selectOption({ index: 1 });
    await page.screenshot({ path: shot("03b-users-form-filled.png") });

    await card.locator('button[type="submit"]').click();
    await page.waitForTimeout(600);
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("03c-users-created.png") });
  });

  /* ═══════════════════════════════════════════════════════════════
     4. ADMIN — DEVICES (list → register → select → settings)
     ═══════════════════════════════════════════════════════════════ */
  test("4. Admin devices — registration & configuration", async ({ page }) => {
    await loginAs(page, "test-admin", "TestPass123!", "**/admin");
    await page.goto("/admin/devices");
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("04a-devices-list.png") });

    // Fill Register Device form (left card)
    const regCard = page.locator('div:has(> h2:has-text("Register Device"))');
    await regCard.locator('input').nth(1).fill("Research-Lab-Display");
    await regCard.locator('input').nth(2).fill("10.42.20.55");
    await regCard.locator('input').nth(3).fill("Research Tower, Room 101");
    const devGroupSelect = regCard.locator('select').first();
    const devGroupOptions = await devGroupSelect.locator('option').allTextContents();
    if (devGroupOptions.length > 1) await devGroupSelect.selectOption({ index: 1 });
    await page.screenshot({ path: shot("04b-devices-form-filled.png") });

    await regCard.locator('button[type="submit"]').click();
    await page.waitForTimeout(600);
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("04c-devices-created.png") });

    // Click the newly created device to open settings panel
    const newRow = page.locator('tr:has-text("Research-Lab-Display")');
    if (await newRow.isVisible().catch(() => false)) {
      await newRow.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: shot("04d-device-selected.png") });
    }
  });

  /* ═══════════════════════════════════════════════════════════════
     5. CREATOR — POSTS (dashboard → list → create → saved)
     ═══════════════════════════════════════════════════════════════ */
  test("5. Creator posts — creating a new post", async ({ page }) => {
    await loginAs(page, "test-creator", "TestPass123!", "**/creator");
    await page.goto("/creator");
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("05a-creator-dashboard.png") });

    await page.goto("/creator/posts");
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("05b-posts-list.png") });

    // Fill New Post form using top-level label selectors
    await page.locator('label:has-text("Title") + input').first().fill("Weekly Research Update");
    await page.locator('label:has-text("Description") + textarea').first().fill("## This Week\n\nNew equipment arrived in Lab 302.");
    await page.screenshot({ path: shot("05c-posts-form-filled.png"), fullPage: true });

    // Upload a tiny image so the form can be saved
    const mockImage = path.resolve(__dirname, "helpers/test-image.png");
    if (!fs.existsSync(mockImage)) {
      fs.writeFileSync(
        mockImage,
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          "base64"
        )
      );
    }
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      await fileInput.setInputFiles(mockImage);
      await page.waitForTimeout(800);
      // Dismiss crop modal if it appears
      const cropBtn = page.locator('button:has-text("Apply crop")');
      if (await cropBtn.isVisible().catch(() => false)) {
        await cropBtn.click();
        await page.waitForTimeout(300);
      }
    }
    await page.screenshot({ path: shot("05d-posts-image-uploaded.png"), fullPage: true });

    const saveBtn = page.locator('button:has-text("Save Post")').first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(1500);
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: shot("05e-posts-saved.png"), fullPage: true });
  });

  /* ═══════════════════════════════════════════════════════════════
     6. CREATOR — DESIGNER (canvas → template → text)
     ═══════════════════════════════════════════════════════════════ */
  test("6. Creator designer — visual canvas workflow", async ({ page }) => {
    await loginAs(page, "test-creator", "TestPass123!", "**/creator");
    await page.goto("/creator/editor");
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("06a-designer-empty.png") });

    // Click a template if available
    const templateBtn = page.locator('button:has-text("Big headline")').first();
    if (await templateBtn.isVisible().catch(() => false)) {
      await templateBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: shot("06b-designer-template.png") });
    }

    // Add text via toolbar
    const textBtn = page.locator('button[title="Add text"]').or(page.locator('button:has-text("Text")')).first();
    if (await textBtn.isVisible().catch(() => false)) {
      await textBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: shot("06c-designer-text.png") });
    }
  });

  /* ═══════════════════════════════════════════════════════════════
     7. CREATOR — SIGNAGE (select post → select devices → publish)
     ═══════════════════════════════════════════════════════════════ */
  test("7. Creator signage — publishing to devices", async ({ page }) => {
    await loginAs(page, "test-creator", "TestPass123!", "**/creator");
    await page.goto("/creator/signage");
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("07a-signage-list.png") });

    // Try to select the first post and first device
    const postSelect = page.locator('select').filter({ hasText: /Select a post/i }).or(page.locator('select').first());
    if (await postSelect.isVisible().catch(() => false)) {
      const options = await postSelect.locator('option').allTextContents();
      if (options.length > 1) await postSelect.selectOption({ index: 1 });
    }

    const deviceChecks = page.locator('input[type="checkbox"]');
    if (await deviceChecks.first().isVisible().catch(() => false)) {
      await deviceChecks.first().check();
    }
    await page.screenshot({ path: shot("07b-signage-select.png") });

    const pubBtn = page.locator('button:has-text("Publish")').or(page.locator('button:has-text("Deploy")')).first();
    if (await pubBtn.isVisible().catch(() => false)) {
      await pubBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: shot("07c-signage-published.png") });
    }
  });

  /* ═══════════════════════════════════════════════════════════════
     8. CREATOR — LIVE STREAMS (list → create form)
     ═══════════════════════════════════════════════════════════════ */
  test("8. Creator live streams — creating a stream", async ({ page }) => {
    await loginAs(page, "test-creator", "TestPass123!", "**/creator");
    await page.goto("/creator/live-streams");
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("08a-livestream-list.png") });

    // Fill new stream form if present
    const titleIn = page.locator('label:has-text("Title") + input, input[placeholder*="Title"]').first();
    if (await titleIn.isVisible().catch(() => false)) {
      await titleIn.fill("Graduation Ceremony Live");
      const urlIn = page.locator('label:has-text("URL") + input, input[placeholder*="URL"]').first();
      if (await urlIn.isVisible().catch(() => false)) {
        await urlIn.fill("rtsp://localhost:8554/graduation");
      }
      const typeSel = page.locator('label:has-text("Type") + select, select').first();
      if (await typeSel.isVisible().catch(() => false)) {
        await typeSel.selectOption("RTSP");
      }
      await page.screenshot({ path: shot("08b-livestream-form.png") });

      const saveBtn = page.locator('button[type="submit"]').or(page.locator('button:has-text("Save")')).first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: shot("08c-livestream-created.png") });
      }
    }
  });

  /* ═══════════════════════════════════════════════════════════════
     9. PUBLIC FEED (list → post detail)
     ═══════════════════════════════════════════════════════════════ */
  test("9. Public feed — browsing posts", async ({ page }) => {
    await page.goto("/feed");
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("09a-feed.png") });

    // Click the first post card
    const card = page.locator('a[href^="/post/"]').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForURL("**/post/**", { timeout: 5000 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: shot("09b-post-detail.png") });
    }
  });

  /* ═══════════════════════════════════════════════════════════════
     10. EMERGENCY PROCEDURES (group emergency state → post detail)
     ═══════════════════════════════════════════════════════════════ */
  test("10. Emergency — group state and alert detail", async ({ page }) => {
    await loginAs(page, "test-admin", "TestPass123!", "**/admin");
    await page.goto("/admin/groups");
    await page.waitForTimeout(300);
    // Show Emergency Broadcast group in EMERGENCY state
    await page.screenshot({ path: shot("10a-emergency-groups.png") });

    await page.goto("/feed");
    await page.waitForTimeout(300);
    const card = page.locator('text=EMERGENCY: SEVERE WEATHER ALERT').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForURL("**/post/**", { timeout: 5000 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: shot("10b-emergency-post.png") });
    }
  });

  /* ═══════════════════════════════════════════════════════════════
     11. ADMIN — EDITING GROUPS (toggle emergency state)
     ═══════════════════════════════════════════════════════════════ */
  test("11. Admin groups — editing existing group state", async ({ page }) => {
    await loginAs(page, "test-admin", "TestPass123!", "**/admin");
    await page.goto("/admin/groups");
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("11a-groups-table.png"), fullPage: true });

    // Open the inline state dropdown of the first group row (if rendered as a select)
    const firstStateSelect = page.locator('table select, [data-test="group-state-select"]').first();
    if (await firstStateSelect.isVisible().catch(() => false)) {
      await firstStateSelect.scrollIntoViewIfNeeded();
      await page.screenshot({ path: shot("11b-groups-edit-state.png"), fullPage: true });
    } else {
      await page.screenshot({ path: shot("11b-groups-edit-state.png"), fullPage: true });
    }

    // Show the emergency button
    const emBtn = page.locator('button:has-text("Emergency"), button:has-text("🚨")').first();
    if (await emBtn.isVisible().catch(() => false)) {
      await emBtn.scrollIntoViewIfNeeded();
    }
    await page.screenshot({ path: shot("11c-groups-emergency-btn.png"), fullPage: true });
  });

  /* ═══════════════════════════════════════════════════════════════
     12. ADMIN — EDITING USERS (inline role / approval changes)
     ═══════════════════════════════════════════════════════════════ */
  test("12. Admin users — editing existing user", async ({ page }) => {
    await loginAs(page, "test-admin", "TestPass123!", "**/admin");
    await page.goto("/admin/users");
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("12a-users-table.png"), fullPage: true });

    // Show the existing user table with inline editable fields
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.scrollIntoViewIfNeeded();
    }
    await page.screenshot({ path: shot("12b-users-row-detail.png"), fullPage: true });
  });

  /* ═══════════════════════════════════════════════════════════════
     13. ADMIN — EDITING DEVICE (select → settings → emergency asset)
     ═══════════════════════════════════════════════════════════════ */
  test("13. Admin devices — editing & emergency asset upload", async ({ page }) => {
    await loginAs(page, "test-admin", "TestPass123!", "**/admin");
    await page.goto("/admin/devices");
    await page.waitForTimeout(300);

    // Click the first device row to load the Settings panel
    const row = page.locator('table tbody tr, [data-test="device-row"]').first();
    if (await row.isVisible().catch(() => false)) {
      await row.click();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: shot("13a-device-settings.png"), fullPage: true });

    // Show the Reset / Erase / Save buttons in the settings card
    const resetBtn = page.locator('button:has-text("Reset")').first();
    if (await resetBtn.isVisible().catch(() => false)) {
      await resetBtn.scrollIntoViewIfNeeded();
    }
    await page.screenshot({ path: shot("13b-device-actions.png"), fullPage: true });

    // Show the Emergency Asset upload card
    const eaCard = page.locator('text=Emergency Asset').first();
    if (await eaCard.isVisible().catch(() => false)) {
      await eaCard.scrollIntoViewIfNeeded();
    }
    await page.screenshot({ path: shot("13c-device-emergency-asset.png"), fullPage: true });
  });

  /* ═══════════════════════════════════════════════════════════════
     14. CREATOR — MARKDOWN DESIGNER MODE
     ═══════════════════════════════════════════════════════════════ */
  test("14. Creator designer — markdown slide mode", async ({ page }) => {
    await loginAs(page, "test-creator", "TestPass123!", "**/creator");
    await page.goto("/creator/editor");
    await page.waitForTimeout(300);

    // Click the Markdown mode toggle
    const mdToggle = page.locator('button:has-text("Markdown"), label:has-text("Markdown") input').first();
    if (await mdToggle.isVisible().catch(() => false)) {
      await mdToggle.click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: shot("14a-designer-md-empty.png"), fullPage: true });

    // Type some markdown content
    const mdArea = page.locator('textarea').first();
    if (await mdArea.isVisible().catch(() => false)) {
      await mdArea.fill("# Spring Symposium\n\n- Mar 15, Main Hall\n- Free for students\n- **Register by Friday**");
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: shot("14b-designer-md-filled.png"), fullPage: true });
  });

  /* ═══════════════════════════════════════════════════════════════
     15. POST DETAIL — AI ASSISTANT CHAT
     ═══════════════════════════════════════════════════════════════ */
  test("15. Post detail — opening AI assistant chat", async ({ page }) => {
    await page.goto("/feed");
    await page.waitForTimeout(300);

    // Open the first post detail
    const card = page.locator('a[href^="/post/"]').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForURL("**/post/**", { timeout: 5000 });
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: shot("15a-post-detail-full.png"), fullPage: true });

    // Try to open the AI chat (floating button)
    const aiBtn = page.locator('button[aria-label*="AI"], button:has-text("Ask"), button:has(svg)').filter({ hasText: /chat|ask|ai/i }).first();
    const altAiBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
    const btn = (await aiBtn.isVisible().catch(() => false)) ? aiBtn : altAiBtn;
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: shot("15b-post-ai-chat-open.png"), fullPage: true });

    // Type a sample question
    const aiInput = page.locator('textarea, input[type="text"]').last();
    if (await aiInput.isVisible().catch(() => false)) {
      await aiInput.fill("What is this post about?");
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: shot("15c-post-ai-question.png"), fullPage: true });
  });

  /* ═══════════════════════════════════════════════════════════════
     16. CREATOR — ATTACHMENTS ON EXISTING POST
     (attachments require an already-saved post)
     ═══════════════════════════════════════════════════════════════ */
  test("16. Creator posts — uploading attachment to existing post", async ({ page }) => {
    await loginAs(page, "test-creator", "TestPass123!", "**/creator");
    await page.goto("/creator/posts");
    await page.waitForSelector('h1:has-text("My Posts")', { timeout: 15000 }).catch(() => {});

    // Click the edit (pencil) button on the first post row
    const editBtn = page.locator('button[aria-label*="Edit"], button:has-text("Edit")').or(
      page.locator('button').filter({ has: page.locator('svg') })
    ).first();
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: shot("16a-post-edit-open.png"), fullPage: true });

    // The Attachments card becomes active when editing an existing post
    const attachmentsCard = page.locator('text=/Attachments/i').first();
    if (await attachmentsCard.isVisible().catch(() => false)) {
      await attachmentsCard.scrollIntoViewIfNeeded();
    }
    await page.screenshot({ path: shot("16b-post-attachments-card.png"), fullPage: true });

    // Try to attach a PDF
    const fixturePdf = path.resolve(__dirname, "doc-fixtures/media/safety-guide.pdf");
    const fileInputs = page.locator('input[type="file"]');
    const inputCount = await fileInputs.count();
    if (inputCount > 0 && fs.existsSync(fixturePdf)) {
      // Pick the last file input (attachments are usually below images)
      try {
        await fileInputs.last().setInputFiles(fixturePdf);
        await page.waitForTimeout(800);
      } catch {}
    }
    await page.screenshot({ path: shot("16c-post-attachment-uploaded.png"), fullPage: true });
  });

  /* ═══════════════════════════════════════════════════════════════
     17. CREATOR — LIVE STREAM EDIT / START / STOP / DELETE
     ═══════════════════════════════════════════════════════════════ */
  test("17. Creator live streams — editing & lifecycle", async ({ page }) => {
    await loginAs(page, "test-creator", "TestPass123!", "**/creator");
    await page.goto("/creator/live-streams");
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("17a-livestreams-table.png"), fullPage: true });

    // Click an existing stream's Edit button
    const editStreamBtn = page.locator('button:has-text("Edit")').first();
    if (await editStreamBtn.isVisible().catch(() => false)) {
      await editStreamBtn.click();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: shot("17b-livestream-edit.png"), fullPage: true });

    // Show Details panel (expand)
    const detailsBtn = page.locator('button:has-text("Details")').first();
    if (await detailsBtn.isVisible().catch(() => false)) {
      await detailsBtn.click();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: shot("17c-livestream-details.png"), fullPage: true });
  });
});
