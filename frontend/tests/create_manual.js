/**
 * Manual Creator — Step-by-Step UI Documentation Generator
 *
 * Reads the doc-fixtures and the screenshots captured by `generate_docs.spec.js`
 * and produces a USER_MANUAL.md where every step is rendered as a tight unit:
 *
 *   **Step N — Title**
 *   Instruction text.
 *   ![Figure caption](path/to/screenshot.png)
 *   *Figure N: caption*
 *
 * Usage:
 *   node tests/create_manual.js
 *
 * Environment:
 *   SCREENSHOT_DIR  - directory with auto-generated screenshots
 *                     (default: tests/../docs/auto-generated)
 *   OUTPUT_PATH     - output markdown path
 *                     (default: tests/doc-fixtures/USER_MANUAL.md)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FIXTURES_DIR = path.resolve(__dirname, "doc-fixtures");
const SCREENSHOT_DIR = path.resolve(
  process.env.SCREENSHOT_DIR || path.join(__dirname, "../docs/auto-generated")
);
const OUTPUT_PATH = path.resolve(
  process.env.OUTPUT_PATH || path.join(FIXTURES_DIR, "USER_MANUAL.md")
);

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"));
}

function heading(level, text) {
  return `${"#".repeat(level)} ${text}\n\n`;
}

function table(headers, rows) {
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ];
  return lines.join("\n") + "\n\n";
}

function bullet(items) {
  return items.map((i) => `- ${i}`).join("\n") + "\n\n";
}

// Resolve a relative image path for the markdown file
function imgPath(name) {
  const p = path.join(SCREENSHOT_DIR, name);
  return path.relative(path.dirname(OUTPUT_PATH), p).replace(/\\/g, "/");
}

// Figure counter (global, used across sections)
let figureNum = 0;

/**
 * Render a single step. Each step is:
 *   **Step N — Title**
 *   Instruction.
 *
 *   ![Figure caption](image-path)
 *   *Figure F: caption*
 */
function step({ n, title, instruction, screenshot, caption }) {
  figureNum += 1;
  const fig = figureNum;
  const rel = imgPath(screenshot);
  const exists = fs.existsSync(path.join(SCREENSHOT_DIR, screenshot));

  let md = `**Step ${n} — ${title}**\n\n`;
  md += `${instruction}\n\n`;
  if (exists) {
    md += `![Figure ${fig}: ${caption}](${rel})\n\n`;
  } else {
    md += `> 🖼️ *Screenshot pending:* \`${screenshot}\` — ${caption}\n\n`;
  }
  md += `*Figure ${fig}: ${caption}*\n\n`;
  md += `---\n\n`;
  return md;
}

// ──────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────

function generate() {
  const groups = loadJson("groups-sample.json");
  const users = loadJson("users-sample.json");
  const devices = loadJson("devices-sample.json");
  const posts = loadJson("posts-sample.json");
  const aiConversations = loadJson("ai/mock-conversations.json");

  let md = "";

  // ── Title ───────────────────────────────────────────────────────
  md += heading(1, "WebServerSignage — User Manual");
  md += `*Step-by-step UI guide automatically generated from the doc-fixtures and Playwright screenshots on ${new Date().toISOString().split("T")[0]}.*\n\n`;
  md += `Every numbered step below pairs a written instruction with a screenshot captured at that exact moment in the UI.\n\n`;

  // ── Table of Contents ───────────────────────────────────────────
  md += heading(2, "Table of Contents");
  md += bullet([
    "[1. Getting Started — Logging In](#1-getting-started--logging-in)",
    "[2. System Administration](#2-system-administration)",
    "   • [2.1 Managing Groups](#21-managing-groups)",
    "   • [2.2 Managing Users](#22-managing-users)",
    "   • [2.3 Managing Devices](#23-managing-devices)",
    "[3. Content Creation](#3-content-creation)",
    "   • [3.1 Creating a Post](#31-creating-a-post)",
    "   • [3.2 Adding Attachments to an Existing Post](#32-adding-attachments-to-an-existing-post)",
    "   • [3.3 Using the Visual Designer](#33-using-the-visual-designer)",
    "   • [3.4 Markdown Slide Designer](#34-markdown-slide-designer)",
    "   • [3.5 Publishing to Signage](#35-publishing-to-signage)",
    "   • [3.6 Live Streams — Full Lifecycle](#36-live-streams--full-lifecycle)",
    "[4. Public Feed & AI Assistant](#4-public-feed--ai-assistant)",
    "   • [4.1 Browsing the Feed](#41-browsing-the-feed)",
    "   • [4.2 Asking the AI Assistant about a Post](#42-asking-the-ai-assistant-about-a-post)",
    "[5. Emergency Procedures](#5-emergency-procedures)",
    "[6. Editing Existing Entities](#6-editing-existing-entities)",
    "   • [6.1 Editing a Group (toggling Emergency)](#61-editing-a-group-toggling-emergency)",
    "   • [6.2 Editing a User](#62-editing-a-user)",
    "   • [6.3 Editing a Device & Uploading the Emergency Asset](#63-editing-a-device--uploading-the-emergency-asset)",
    "[Appendix A: Mock University Data](#appendix-a-mock-university-data)",
    "[Appendix B: Sample AI Conversations](#appendix-b-sample-ai-conversations)",
  ]);

  // ──────────────────────────────────────────────────────────────
  // 1. GETTING STARTED — LOGGING IN
  // ──────────────────────────────────────────────────────────────
  md += heading(2, "1. Getting Started — Logging In");
  md += `The login screen is the entry point. Admins are routed to \`/admin\`, creators to \`/creator\`, and visitors can browse \`/feed\` without authentication.\n\n`;

  md += step({
    n: "1.1",
    title: "Open the login page",
    instruction: "Open your browser and navigate to **`/login`**. You will see two empty fields and a **Sign In** button.",
    screenshot: "01a-login-empty.png",
    caption: "The login page with empty username and password fields.",
  });

  md += step({
    n: "1.2",
    title: "Enter your credentials",
    instruction: "Type your **username** (e.g. `admin.root`) and **password** (e.g. `AdminPass123!`). The button becomes active once both fields are filled.",
    screenshot: "01b-login-filled.png",
    caption: "Login form after entering valid credentials.",
  });

  md += step({
    n: "1.3",
    title: "Submit and land on your dashboard",
    instruction: "Click **Sign In**. The system stores your JWT in `localStorage` and redirects you based on role. Admins arrive at the Admin Dashboard shown below.",
    screenshot: "01c-admin-dashboard.png",
    caption: "Admin dashboard immediately after a successful login.",
  });

  md += `**Pre-seeded mock accounts:**\n\n`;
  md += table(
    ["Role", "Username", "Password", "Display Name"],
    users.map((u) => [u.role, `\`${u.username}\``, `\`${u.password}\``, u.display_name]),
  );

  // ──────────────────────────────────────────────────────────────
  // 2. SYSTEM ADMINISTRATION
  // ──────────────────────────────────────────────────────────────
  md += heading(2, "2. System Administration");
  md += `Admins manage the campus topology: **Groups** (departments), **Users** (creators/admins), and **Devices** (Raspberry Pi displays).\n\n`;

  // ── 2.1 GROUPS ────────────────────────────────────────────────
  md += heading(3, "2.1 Managing Groups");
  md += `Groups are the security and visibility boundary. Every post, user, and device belongs to at least one group.\n\n`;

  md += step({
    n: "2.1.1",
    title: "Open the Groups page",
    instruction: "From the admin sidebar, click **Groups**. The page lists every existing group along with its display state, member count, and assigned devices.",
    screenshot: "02a-groups-list.png",
    caption: "Admin Groups page listing all campus groups.",
  });

  md += step({
    n: "2.1.2",
    title: "Fill the Add Group form",
    instruction: "In the **Add Group** card on the left, enter a unique **Name** and an optional **Description**. Choose the **Display mode** (typically `NORMAL`).",
    screenshot: "02b-groups-form-filled.png",
    caption: "Add Group form populated with a new group's data.",
  });

  md += step({
    n: "2.1.3",
    title: "Save the group",
    instruction: "Click **Create**. The new group appears immediately in the table and becomes available to users and devices.",
    screenshot: "02c-groups-created.png",
    caption: "Group list after saving — the newly created group is visible.",
  });

  md += `**Pre-seeded groups in this database:**\n\n`;
  md += table(
    ["ID", "Name", "Description", "Default State"],
    groups.map((g) => [String(g.id), g.name, g.description, g.signage_state]),
  );

  // ── 2.2 USERS ─────────────────────────────────────────────────
  md += heading(3, "2.2 Managing Users");
  md += `Admins create accounts and assign roles (\`admin\`, \`creator\`, \`viewer\`), a primary group, and any additional managed groups.\n\n`;

  md += step({
    n: "2.2.1",
    title: "Open the Users page",
    instruction: "Click **Users** in the admin sidebar. The table on the right lists every account with its role, group, auto-approve flag, and priority.",
    screenshot: "03a-users-list.png",
    caption: "Admin Users page showing all registered accounts.",
  });

  md += step({
    n: "2.2.2",
    title: "Fill the Add User form",
    instruction: "On the left card, enter the **Username**, **Password**, **Role**, and **Primary Group**. Optionally toggle **Auto-approve Posts** and pick **Additional Groups** the user can post to.",
    screenshot: "03b-users-form-filled.png",
    caption: "Add User form filled in for a new creator account.",
  });

  md += step({
    n: "2.2.3",
    title: "Create the user",
    instruction: "Click **Create User**. The new account appears in the table; you can later adjust its role, signage ceiling, or priority inline.",
    screenshot: "03c-users-created.png",
    caption: "User table after successful registration.",
  });

  md += `**Key concepts:**\n\n`;
  md += bullet([
    "**Primary Group** (`group_id`) — The user's home department.",
    "**Managed Groups** (`managed_group_ids`) — Extra departments the user can publish for.",
    "**Auto-approve** — When true, the creator's posts skip admin moderation.",
    "**Max Signage State** — The highest urgency level the creator may assign.",
    "**Control Lock Minutes** — How long a creator can hold exclusive control of a device.",
  ]);

  // ── 2.3 DEVICES ───────────────────────────────────────────────
  md += heading(3, "2.3 Managing Devices");
  md += `Devices represent physical Raspberry Pi displays. Admins register them, approve heartbeats, and configure group membership.\n\n`;

  md += step({
    n: "2.3.1",
    title: "Open the Devices page",
    instruction: "Click **Devices** in the admin sidebar. Three panels appear: Register form (left), the fleet list (center), and the settings inspector (right).",
    screenshot: "04a-devices-list.png",
    caption: "Admin Devices page showing the registered hardware fleet.",
  });

  md += step({
    n: "2.3.2",
    title: "Fill the Register Device form",
    instruction: "Enter the **Device ID** (from the Pi's `config.py`), **Device Name**, **IP Address**, **Location**, and the **Primary Group**. Toggle **Belongs to all groups** if it should display content for every department.",
    screenshot: "04b-devices-form-filled.png",
    caption: "Register Device form filled with new hardware details.",
  });

  md += step({
    n: "2.3.3",
    title: "Register and verify",
    instruction: "Click **Register**. The device joins the list with status `online` as soon as its agent sends a heartbeat.",
    screenshot: "04c-devices-created.png",
    caption: "Device list immediately after registering a new display.",
  });

  md += step({
    n: "2.3.4",
    title: "Inspect a device",
    instruction: "Click any row in the list to load its **Settings** panel on the right. You can rename it, change groups, view sensor logs, upload an **Emergency Asset**, or erase it from the fleet.",
    screenshot: "04d-device-selected.png",
    caption: "Device Settings panel after selecting a row.",
  });

  md += `**Current fleet:**\n\n`;
  md += table(
    ["ID", "Name", "Location", "IP Address", "Primary Group", "Status"],
    devices.map((d) => [
      String(d.id),
      d.device_name,
      d.location,
      d.ip_address,
      groups.find((g) => g.id === d.group_id)?.name || "—",
      d.status,
    ]),
  );

  // ──────────────────────────────────────────────────────────────
  // 3. CONTENT CREATION
  // ──────────────────────────────────────────────────────────────
  md += heading(2, "3. Content Creation");
  md += `Creators write posts, design visual slides, publish them to signage, and manage live streams.\n\n`;

  // ── 3.1 POSTS ─────────────────────────────────────────────────
  md += heading(3, "3.1 Creating a Post");
  md += `Posts are markdown documents with optional images, attachments, and live-stream bindings. They can target multiple groups and be published to the feed, signage, or both.\n\n`;

  md += step({
    n: "3.1.1",
    title: "Log in as a creator and open the dashboard",
    instruction: "Sign in with a creator account (e.g. `prof.thompson` / `CreatorPass123!`). You land on the Creator Dashboard, which summarises your recent posts and signage activity.",
    screenshot: "05a-creator-dashboard.png",
    caption: "Creator Dashboard immediately after login.",
  });

  md += step({
    n: "3.1.2",
    title: "Open the Posts page",
    instruction: "Click **Posts** in the creator sidebar. The left card is the **New Post** editor; the right side lists your existing posts with filters for channel, group, and creator.",
    screenshot: "05b-posts-list.png",
    caption: "Creator Posts page with the new-post editor and post list.",
  });

  md += step({
    n: "3.1.3",
    title: "Write title and description",
    instruction: "Enter a **Title** and write the body in **Markdown** in the description textarea. Use headings, lists, and bold text — they render in the public feed and on the signage detail view.",
    screenshot: "05c-posts-form-filled.png",
    caption: "New Post form with title and markdown description entered.",
  });

  md += step({
    n: "3.1.4",
    title: "Upload media",
    instruction: "Click the file picker to add an **Image** (shown on signage/feed) or an **Attachment** (downloadable PDF/Office file). The crop modal lets you pick the focal area.",
    screenshot: "05d-posts-image-uploaded.png",
    caption: "New Post form after uploading an image.",
  });

  md += step({
    n: "3.1.5",
    title: "Save the post",
    instruction: "Click **Save Post**. If you have *auto-approve* the post is pre-authorised, but it still starts as a **draft** — publish it explicitly when ready.",
    screenshot: "05e-posts-saved.png",
    caption: "Posts list showing the newly created post.",
  });

  md += `**Sample posts in this dataset:**\n\n`;
  md += table(
    ["#", "Title", "Creator", "Groups", "State", "Media"],
    posts.map((p, i) => [
      String(i + 1),
      p.title,
      users.find((u) => u.id === p.created_by)?.display_name || "—",
      p.group_ids.map((gid) => groups.find((g) => g.id === gid)?.name).join(", "),
      p.signage_state,
      p.images?.length
        ? "Image"
        : p.attachments?.length
          ? "PDF"
          : p.live_stream
            ? "Live Stream"
            : "Text",
    ]),
  );

  // ── 3.2 ATTACHMENTS ON EXISTING POST ──────────────────────────
  md += heading(3, "3.2 Adding Attachments to an Existing Post");
  md += `**Important constraint**: PDFs and Office files can only be uploaded to a post that has *already been saved at least once*. The Attachments card is **disabled** while you are still creating a brand-new post — the placeholder text reads *"Save post first to add attachments."*\n\n`;

  md += step({
    n: "3.2.1",
    title: "Open an existing post for editing",
    instruction: "On the **Posts** page, locate the post you want to enrich and click its **edit (pencil) button** on the right side of the row. The form on the left switches from *New Post* to *Edit Post* and now shows your saved values.",
    screenshot: "16a-post-edit-open.png",
    caption: "Posts page with the Edit Post form active for an existing post.",
  });

  md += step({
    n: "3.2.2",
    title: "Locate the Attachments card",
    instruction: "Scroll inside the editor card until you see the **Attachments** section. While editing an existing post, the card becomes interactive and shows an *Add attachment* file picker plus a list of any attachments already attached.",
    screenshot: "16b-post-attachments-card.png",
    caption: "Attachments card unlocked for an existing post.",
  });

  md += step({
    n: "3.2.3",
    title: "Upload a PDF",
    instruction: "Click the file picker and choose a PDF or Office document (max 5 attachments per post). The backend extracts text content from the file so the AI assistant can answer questions about it later.",
    screenshot: "16c-post-attachment-uploaded.png",
    caption: "Post editor after a PDF attachment has been uploaded.",
  });

  // ── 3.3 VISUAL DESIGNER ────────────────────────────────────────
  md += heading(3, "3.3 Using the Visual Designer");
  md += `The designer lets creators build slides with text, shapes, and images on a **Fabric.js** canvas. The result is exported as a JPEG that you can attach to a post.\n\n`;

  md += step({
    n: "3.3.1",
    title: "Open the Editor",
    instruction: "From the creator sidebar, click **Signage Designer**. The canvas starts blank; the mode toggle at the top selects between **Visual** (default) and **Markdown slide**.",
    screenshot: "06a-designer-empty.png",
    caption: "Creator Editor with an empty visual canvas.",
  });

  md += step({
    n: "3.3.2",
    title: "Apply a template",
    instruction: "Pick a starter template such as **Big headline**, **Lower third**, **Split panel**, or **Hours / list**. The canvas populates with placeholder text and shapes you can customise.",
    screenshot: "06b-designer-template.png",
    caption: "Canvas after applying a headline template.",
  });

  md += step({
    n: "3.3.3",
    title: "Add and style elements",
    instruction: "Use the toolbar to add **Text**, rectangles, circles, or upload images. Customise colours, fonts, and positions. Click **Use this slide** to export the design as a JPEG that can be attached to a post.",
    screenshot: "06c-designer-text.png",
    caption: "Canvas after adding custom text elements.",
  });

  // ── 3.4 MARKDOWN DESIGNER ──────────────────────────────────────
  md += heading(3, "3.4 Markdown Slide Designer");
  md += `If you prefer typing over dragging shapes, switch the designer into **Markdown** mode. Your markdown is rendered live with KaTeX support for math and exported as a JPEG sized for the chosen TV preset.\n\n`;

  md += step({
    n: "3.4.1",
    title: "Switch to Markdown mode",
    instruction: "Click the **Markdown** toggle at the top of the designer. The canvas is replaced by a textarea on the left and a live-preview panel on the right.",
    screenshot: "14a-designer-md-empty.png",
    caption: "Designer in markdown mode with an empty editor.",
  });

  md += step({
    n: "3.4.2",
    title: "Write your slide",
    instruction: "Type in standard markdown — headings, lists, **bold**, math like `$E=mc^2$`, even tables. Adjust font size, font family, and colours via the right-hand toolbar. The preview reflows automatically as you type.",
    screenshot: "14b-designer-md-filled.png",
    caption: "Designer with a markdown slide fully written and rendered live.",
  });

  // ── 3.5 SIGNAGE ───────────────────────────────────────────────
  md += heading(3, "3.5 Publishing to Signage");
  md += `After a post exists, it must be explicitly published to selected devices. The backend then pushes a real-time sync command via Socket.IO so every targeted Pi updates within seconds.\n\n`;

  md += step({
    n: "3.5.1",
    title: "Open the Signage page",
    instruction: "Click **Signage** in the creator sidebar. You see a list of your publishable posts on the left and the devices in your groups on the right.",
    screenshot: "07a-signage-list.png",
    caption: "Signage Publish page listing posts and target devices.",
  });

  md += step({
    n: "3.5.2",
    title: "Select post and devices",
    instruction: "Pick a **Post** from the dropdown and tick the **Devices** that should display it. Set a **Duration** (seconds per slide) and a **Priority** to control rotation order.",
    screenshot: "07b-signage-select.png",
    caption: "Post and devices selected for publishing.",
  });

  md += step({
    n: "3.5.3",
    title: "Publish",
    instruction: "Click **Publish**. The targeted Pi devices receive an instant `signage_sync` event over Socket.IO, download any new media, and add the slide to their rotation. A confirmation banner appears at the top of the page.",
    screenshot: "07c-signage-published.png",
    caption: "Signage page after a successful publish.",
  });

  // ── 3.6 LIVE STREAMS — FULL LIFECYCLE ──────────────────────────
  md += heading(3, "3.6 Live Streams — Full Lifecycle");
  md += `Live streams come in four flavours: **HLS** (\`.m3u8\` URL), **RTSP** (IP camera), **YouTube Live**, and **RTMP** (OBS ingest). Once created, a stream can be attached to a post just like an image — signage devices play the live feed instead of static media. This section covers create, edit, start/stop, and inspect.\n\n`;

  md += step({
    n: "3.6.1",
    title: "Open the Live Streams page",
    instruction: "Click **Live Streams** in the creator sidebar. Existing streams appear in a list, each showing its source URL, status (online/offline/error), and per-row action buttons.",
    screenshot: "08a-livestream-list.png",
    caption: "Live Streams page with the list of existing streams.",
  });

  md += step({
    n: "3.6.2",
    title: "Configure a new stream",
    instruction: "Enter the **Title**, choose a **Stream Type** (RTSP/HLS/YouTube/RTMP), paste the **Source URL** (omitted for RTMP, which generates its own ingest endpoint), and select the **Group** that owns it.",
    screenshot: "08b-livestream-form.png",
    caption: "Live stream creation form filled with source details.",
  });

  md += step({
    n: "3.6.3",
    title: "Save the stream",
    instruction: "Click **Save**. The stream now appears in the list and becomes selectable from the post editor's *Use live stream* option. After saving you can also upload a **thumbnail** for the post preview.",
    screenshot: "08c-livestream-created.png",
    caption: "Live Streams list after creating a new stream.",
  });

  md += step({
    n: "3.6.4",
    title: "Edit an existing stream",
    instruction: "Click the **Edit** button on any stream row. The form on the left flips to *Edit Live Stream* and is pre-populated with the saved values. Update any field and click **Update Stream** to apply the change without affecting active deployments.",
    screenshot: "17b-livestream-edit.png",
    caption: "Live stream edit form populated with the saved values of an existing stream.",
  });

  md += step({
    n: "3.6.5",
    title: "Start, stop, and inspect",
    instruction: "Use the **Start / Stop** buttons (RTSP/YouTube/RTMP) to control the relay. Click **Details** on a row to expand a panel showing the source URL, the public HLS relay URL, the stream key, last-seen timestamp, and recent error logs. **Refresh** re-pulls the most recent log lines.",
    screenshot: "17c-livestream-details.png",
    caption: "Expanded details panel of a live stream with source/relay URLs and logs.",
  });

  // ──────────────────────────────────────────────────────────────
  // 4. PUBLIC FEED & AI ASSISTANT
  // ──────────────────────────────────────────────────────────────
  md += heading(2, "4. Public Feed & AI Assistant");
  md += `The public feed at **\`/feed\`** shows every post marked **Allowed on Feed** with **Published** status. No login is required. Visitors can also chat with an **AI assistant** that has been grounded on the post's markdown body and any attached PDF/Office files.\n\n`;

  md += heading(3, "4.1 Browsing the Feed");

  md += step({
    n: "4.1.1",
    title: "Open the feed",
    instruction: "Navigate to **`/feed`** in any browser. Posts are sorted by priority and recency. Each card shows the title, hero image, group, and creator.",
    screenshot: "09a-feed.png",
    caption: "Public feed showing all campus announcements.",
  });

  md += step({
    n: "4.1.2",
    title: "Open a post detail",
    instruction: "Click any card to open the detail view at **`/post/:id`**. The full markdown body, all images, and any attached PDFs are rendered. Live streams play inline when available.",
    screenshot: "09b-post-detail.png",
    caption: "Post detail page showing full content and media.",
  });

  md += heading(3, "4.2 Asking the AI Assistant about a Post");
  md += `Each post detail page surfaces a floating **AI chat** widget in the bottom-right corner. The assistant is grounded on the post's text body **and** the extracted text of every attachment, so it answers contextually — not generically.\n\n`;

  md += step({
    n: "4.2.1",
    title: "View the post detail page",
    instruction: "From `/feed`, click any post. The detail page renders the full markdown body, hero image, attachments list, and the floating AI chat button.",
    screenshot: "15a-post-detail-full.png",
    caption: "Post detail page with the floating AI chat button visible bottom-right.",
  });

  md += step({
    n: "4.2.2",
    title: "Open the AI chat",
    instruction: "Click the **AI** button in the bottom-right corner. A resizable chat window slides up. The assistant first verifies that the post has enough context (markdown body or attachments) before allowing questions.",
    screenshot: "15b-post-ai-chat-open.png",
    caption: "AI chat window opened on a post detail page.",
  });

  md += step({
    n: "4.2.3",
    title: "Ask a question",
    instruction: "Type a question in plain English and click **Send** (or press Enter). The assistant streams an answer back, with markdown formatting and code blocks rendered inline. Use the **Stop** button to interrupt a long response, and the **Copy** button on any answer to put it on your clipboard.",
    screenshot: "15c-post-ai-question.png",
    caption: "AI chat after a sample question has been typed.",
  });

  // ──────────────────────────────────────────────────────────────
  // 5. EMERGENCY PROCEDURES
  // ──────────────────────────────────────────────────────────────
  md += heading(2, "5. Emergency Procedures");
  md += `Emergency mode is a **group-level** state. When a group's signage state is set to **EMERGENCY**, every approved device in that group immediately overrides its normal playlist with the local emergency fallback asset and the corresponding emergency post.\n\n`;

  md += `**Triggers:**\n\n`;
  md += bullet([
    "**Hardware button** — pressing the emergency button on any Raspberry Pi broadcasts to all devices in its group via Socket.IO.",
    "**Admin action** — flipping a group's **Signage State** to `EMERGENCY` in the admin UI.",
  ]);

  md += step({
    n: "5.1",
    title: "Mark a group as EMERGENCY (admin)",
    instruction: "Open **Admin → Groups**, locate the affected group, change its **Display mode** dropdown to `EMERGENCY`, and click the red **🚨 Emergency** button to confirm.",
    screenshot: "10a-emergency-groups.png",
    caption: "Groups page showing the Emergency Broadcast group in EMERGENCY state.",
  });

  md += step({
    n: "5.2",
    title: "Verify the emergency post on the feed",
    instruction: "Visit **`/feed`** and open the emergency alert post. The detail page highlights the urgency and shows the canonical emergency message displayed on every device.",
    screenshot: "10b-emergency-post.png",
    caption: "Emergency alert post detail view in EMERGENCY state.",
  });

  md += `**To clear an emergency**, return to **Admin → Groups**, edit the affected group, and change its **Display mode** back to **NORMAL**. The backend emits an \`emergency_mode_end\` signal and all devices in the group resume normal rotation. Editing or deleting individual posts does **not** affect the group's emergency state.\n\n`;

  // ──────────────────────────────────────────────────────────────
  // 6. EDITING EXISTING ENTITIES
  // ──────────────────────────────────────────────────────────────
  md += heading(2, "6. Editing Existing Entities");
  md += `Most admin pages list entities in a table on the right and offer the *create* form on the left. Editing is done **inline** on each row (groups, users) or by clicking a row to load a dedicated **Settings** panel (devices). This section walks through each.\n\n`;

  // ── 6.1 GROUP EDIT ──────────────────────────────────────────
  md += heading(3, "6.1 Editing a Group (toggling Emergency)");
  md += `Beyond renaming or rewriting the description, the most consequential edit on a group is changing its **Signage State**. Toggling to \`EMERGENCY\` immediately overrides every device in the group; toggling back to \`NORMAL\` resumes regular playback.\n\n`;

  md += step({
    n: "6.1.1",
    title: "Open the Groups page",
    instruction: "Navigate to **Admin → Groups**. The right panel shows the existing groups, each with its current state, member count, and inline editing controls.",
    screenshot: "11a-groups-table.png",
    caption: "Groups page with all groups listed and their current states.",
  });

  md += step({
    n: "6.1.2",
    title: "Change a group's signage state",
    instruction: "On any row, use the **Display Mode** dropdown to pick a state (`NORMAL`, `BREAKING_NEWS`, `SECURITY_RISK`, `EMERGENCY`). The change is saved as soon as you select an option — no separate save button is required.",
    screenshot: "11b-groups-edit-state.png",
    caption: "Inline state dropdown of an existing group.",
  });

  md += step({
    n: "6.1.3",
    title: "Trigger Emergency",
    instruction: "Use the dedicated **🚨 Emergency** button on a group row to flip the state to `EMERGENCY` with a confirmation dialog. To clear all active emergencies at once, use the **Clear all emergencies** button at the top of the page.",
    screenshot: "11c-groups-emergency-btn.png",
    caption: "Emergency button on a group row.",
  });

  // ── 6.2 USER EDIT ──────────────────────────────────────────
  md += heading(3, "6.2 Editing a User");
  md += `User accounts are edited inline from the Users table. You can change the **role**, **primary group**, **auto-approve** flag, **max signage state**, **creator priority**, and **control-lock minutes** without opening a separate page.\n\n`;

  md += step({
    n: "6.2.1",
    title: "Open the Users page",
    instruction: "Navigate to **Admin → Users**. The right panel lists all accounts with inline editing controls in each cell.",
    screenshot: "12a-users-table.png",
    caption: "Users page with the full account roster.",
  });

  md += step({
    n: "6.2.2",
    title: "Edit a row in place",
    instruction: "Click any cell to edit it. Common edits: changing **Role** (creator ↔ admin), updating the **Primary Group**, toggling **Auto-approve**, setting **Creator Priority** (lower number = higher priority in signage rotation), or changing **Max Signage State** (cap on how urgent a creator's posts can be).",
    screenshot: "12b-users-row-detail.png",
    caption: "User table with a row ready for inline edits.",
  });

  // ── 6.3 DEVICE EDIT ──────────────────────────────────────────
  md += heading(3, "6.3 Editing a Device & Uploading the Emergency Asset");
  md += `Devices have the richest edit panel: name, IP, location, primary group, additional groups, *all-groups* flag, plus three **action buttons** (Save, Reset to Defaults, Erase & Remove) and an **Emergency Asset** uploader. Selecting a row in the device list loads its full settings on the right.\n\n`;

  md += step({
    n: "6.3.1",
    title: "Select a device",
    instruction: "Navigate to **Admin → Devices**. Click any row in the centre list to load its settings on the right. Pending registrations and pending remote-identity changes appear as a banner at the top of the panel with **Approve** / **Reject** buttons.",
    screenshot: "13a-device-settings.png",
    caption: "Device Settings panel after selecting a row.",
  });

  md += step({
    n: "6.3.2",
    title: "Update settings or remove",
    instruction: "Edit the form fields and click **Save Device** to persist. **🔄 Reset to Agent Defaults** clears server-side overrides so the device picks up its own `config.py` values on next heartbeat. **🗑️ Erase & Remove Device** wipes all images from the TV and removes the device entirely — irreversible.",
    screenshot: "13b-device-actions.png",
    caption: "Device action buttons: Save, Reset, and Erase.",
  });

  md += step({
    n: "6.3.3",
    title: "Upload the Emergency Asset",
    instruction: "Each device can have a **dedicated emergency image or video** stored locally on the Pi. When the group enters EMERGENCY mode, this asset is the override that plays immediately. Use the file picker in the red Emergency Asset card and click **Upload Emergency Asset** to install it. The current asset path is shown above the picker.",
    screenshot: "13c-device-emergency-asset.png",
    caption: "Device Emergency Asset upload card.",
  });

  // ──────────────────────────────────────────────────────────────
  // APPENDIX A — RAW MOCK DATA
  // ──────────────────────────────────────────────────────────────
  md += heading(2, "Appendix A: Mock University Data");
  md += `Raw fixture data used to seed this database and generate the screenshots above.\n\n`;

  md += heading(3, "A.1 Users");
  md += table(
    ["ID", "Username", "Role", "Primary Group", "Managed Groups", "Auto Approve", "Max State"],
    users.map((u) => [
      String(u.id),
      u.username,
      u.role,
      groups.find((g) => g.id === u.group_id)?.name || "—",
      u.managed_group_ids.map((gid) => groups.find((g) => g.id === gid)?.name).join(", ") || "—",
      u.auto_approve ? "Yes" : "No",
      u.max_signage_state,
    ]),
  );

  md += heading(3, "A.2 Groups");
  md += table(
    ["ID", "Name", "Description", "State"],
    groups.map((g) => [String(g.id), g.name, g.description, g.signage_state]),
  );

  md += heading(3, "A.3 Devices");
  md += table(
    ["ID", "Name", "Location", "IP", "Groups", "Status"],
    devices.map((d) => [
      String(d.id),
      d.device_name,
      d.location,
      d.ip_address,
      d.group_ids.map((gid) => groups.find((g) => g.id === gid)?.name).join(", "),
      d.status,
    ]),
  );

  md += heading(3, "A.4 Posts");
  md += table(
    ["ID", "Title", "Creator", "Groups", "State", "Feed", "Signage", "Priority"],
    posts.map((p) => [
      String(p.id),
      p.title,
      users.find((u) => u.id === p.created_by)?.display_name || "—",
      p.group_ids.map((gid) => groups.find((g) => g.id === gid)?.name).join(", "),
      p.signage_state,
      p.allowed_on_feed ? "Yes" : "No",
      p.allowed_on_signage ? "Yes" : "No",
      String(p.priority),
    ]),
  );

  // ──────────────────────────────────────────────────────────────
  // APPENDIX B — AI CONVERSATIONS
  // ──────────────────────────────────────────────────────────────
  md += heading(2, "Appendix B: Sample AI Conversations");
  md += `These question-and-answer pairs are the canonical fixtures the **Post AI Assistant** is benchmarked against. Each scenario is bound to one of the seeded posts via its \`scenario_id\` and exercises the assistant's ability to reason over the post body and any attached PDFs.\n\n`;

  for (const sc of aiConversations) {
    md += `### ${sc.scenario_id} — ${sc.topic || "(unnamed scenario)"}\n\n`;
    for (const conv of sc.conversations) {
      md += `> **Q:** ${conv.question}\n`;
      md += `> **A:** ${conv.answer}\n\n`;
    }
  }

  fs.writeFileSync(OUTPUT_PATH, md, "utf8");
  console.log(`✅ Manual written to ${OUTPUT_PATH}`);
  console.log(`   Screenshots resolved from: ${SCREENSHOT_DIR}`);
  console.log(`   Total figures: ${figureNum}`);
}

generate();
