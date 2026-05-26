# WebServerSignage — User Manual

*Step-by-step UI guide automatically generated from the doc-fixtures and Playwright screenshots on 2026-05-26.*

Every numbered step below pairs a written instruction with a screenshot captured at that exact moment in the UI.

## Table of Contents

- [1. Getting Started — Logging In](#1-getting-started--logging-in)
- [2. System Administration](#2-system-administration)
-    • [2.1 Managing Groups](#21-managing-groups)
-    • [2.2 Managing Users](#22-managing-users)
-    • [2.3 Managing Devices](#23-managing-devices)
- [3. Content Creation](#3-content-creation)
-    • [3.1 Creating a Post](#31-creating-a-post)
-    • [3.2 Adding Attachments to an Existing Post](#32-adding-attachments-to-an-existing-post)
-    • [3.3 Using the Visual Designer](#33-using-the-visual-designer)
-    • [3.4 Markdown Slide Designer](#34-markdown-slide-designer)
-    • [3.5 Publishing to Signage](#35-publishing-to-signage)
-    • [3.6 Live Streams — Full Lifecycle](#36-live-streams--full-lifecycle)
- [4. Public Feed & AI Assistant](#4-public-feed--ai-assistant)
-    • [4.1 Browsing the Feed](#41-browsing-the-feed)
-    • [4.2 Asking the AI Assistant about a Post](#42-asking-the-ai-assistant-about-a-post)
- [5. Emergency Procedures](#5-emergency-procedures)
- [6. Editing Existing Entities](#6-editing-existing-entities)
-    • [6.1 Editing a Group (toggling Emergency)](#61-editing-a-group-toggling-emergency)
-    • [6.2 Editing a User](#62-editing-a-user)
-    • [6.3 Editing a Device & Uploading the Emergency Asset](#63-editing-a-device--uploading-the-emergency-asset)
- [Appendix A: Mock University Data](#appendix-a-mock-university-data)
- [Appendix B: Sample AI Conversations](#appendix-b-sample-ai-conversations)

## 1. Getting Started — Logging In

The login screen is the entry point. Admins are routed to `/admin`, creators to `/creator`, and visitors can browse `/feed` without authentication.

**Step 1.1 — Open the login page**

Open your browser and navigate to **`/login`**. You will see two empty fields and a **Sign In** button.

![Figure 1: The login page with empty username and password fields.](../../docs/auto-generated/01a-login-empty.png)

*Figure 1: The login page with empty username and password fields.*

---

**Step 1.2 — Enter your credentials**

Type your **username** (e.g. `admin.root`) and **password** (e.g. `AdminPass123!`). The button becomes active once both fields are filled.

![Figure 2: Login form after entering valid credentials.](../../docs/auto-generated/01b-login-filled.png)

*Figure 2: Login form after entering valid credentials.*

---

**Step 1.3 — Submit and land on your dashboard**

Click **Sign In**. The system stores your JWT in `localStorage` and redirects you based on role. Admins arrive at the Admin Dashboard shown below.

![Figure 3: Admin dashboard immediately after a successful login.](../../docs/auto-generated/01c-admin-dashboard.png)

*Figure 3: Admin dashboard immediately after a successful login.*

---

**Pre-seeded mock accounts:**

| Role | Username | Password | Display Name |
| --- | --- | --- | --- |
| admin | `admin.root` | `AdminPass123!` | Dr. Sarah Mitchell |
| creator | `prof.thompson` | `CreatorPass123!` | Prof. James Thompson |
| creator | `lib.director` | `CreatorPass123!` | Elena Rodriguez |
| creator | `su.events` | `CreatorPass123!` | Kevin Zhang |
| creator | `it.manager` | `CreatorPass123!` | Marcus Vane |
| creator | `security.lead` | `CreatorPass123!` | Chief Robert Miller |
| creator | `dining.coord` | `CreatorPass123!` | Samantha Lee |

## 2. System Administration

Admins manage the campus topology: **Groups** (departments), **Users** (creators/admins), and **Devices** (Raspberry Pi displays).

### 2.1 Managing Groups

Groups are the security and visibility boundary. Every post, user, and device belongs to at least one group.

**Step 2.1.1 — Open the Groups page**

From the admin sidebar, click **Groups**. The page lists every existing group along with its display state, member count, and assigned devices.

![Figure 4: Admin Groups page listing all campus groups.](../../docs/auto-generated/02a-groups-list.png)

*Figure 4: Admin Groups page listing all campus groups.*

---

**Step 2.1.2 — Fill the Add Group form**

In the **Add Group** card on the left, enter a unique **Name** and an optional **Description**. Choose the **Display mode** (typically `NORMAL`).

![Figure 5: Add Group form populated with a new group's data.](../../docs/auto-generated/02b-groups-form-filled.png)

*Figure 5: Add Group form populated with a new group's data.*

---

**Step 2.1.3 — Save the group**

Click **Create**. The new group appears immediately in the table and becomes available to users and devices.

![Figure 6: Group list after saving — the newly created group is visible.](../../docs/auto-generated/02c-groups-created.png)

*Figure 6: Group list after saving — the newly created group is visible.*

---

**Pre-seeded groups in this database:**

| ID | Name | Description | Default State |
| --- | --- | --- | --- |
| 1 | ECE Department | Electrical & Computer Engineering - academic news, lab schedules, and faculty notices. | NORMAL |
| 2 | Main Library | Public signage for the main campus library, study room availability, and event alerts. | NORMAL |
| 3 | Student Union | Student activity center, club announcements, and general campus life updates. | NORMAL |
| 4 | Campus Security | Security alerts, lost & found, and emergency protocol communications. | EMERGENCY |
| 5 | IT Services | System status updates, help desk hours, and technology workshops. | NORMAL |
| 6 | Dining Services | Menu boards for campus cafeterias, nutrition info, and dining hours. | NORMAL |
| 7 | Emergency Broadcast | Highest priority group for campus-wide emergency alerts and critical safety info. | EMERGENCY |

### 2.2 Managing Users

Admins create accounts and assign roles (`admin`, `creator`, `viewer`), a primary group, and any additional managed groups.

**Step 2.2.1 — Open the Users page**

Click **Users** in the admin sidebar. The table on the right lists every account with its role, group, auto-approve flag, and priority.

![Figure 7: Admin Users page showing all registered accounts.](../../docs/auto-generated/03a-users-list.png)

*Figure 7: Admin Users page showing all registered accounts.*

---

**Step 2.2.2 — Fill the Add User form**

On the left card, enter the **Username**, **Password**, **Role**, and **Primary Group**. Optionally toggle **Auto-approve Posts** and pick **Additional Groups** the user can post to.

![Figure 8: Add User form filled in for a new creator account.](../../docs/auto-generated/03b-users-form-filled.png)

*Figure 8: Add User form filled in for a new creator account.*

---

**Step 2.2.3 — Create the user**

Click **Create User**. The new account appears in the table; you can later adjust its role, signage ceiling, or priority inline.

![Figure 9: User table after successful registration.](../../docs/auto-generated/03c-users-created.png)

*Figure 9: User table after successful registration.*

---

**Key concepts:**

- **Primary Group** (`group_id`) — The user's home department.
- **Managed Groups** (`managed_group_ids`) — Extra departments the user can publish for.
- **Auto-approve** — When true, the creator's posts skip admin moderation.
- **Max Signage State** — The highest urgency level the creator may assign.
- **Control Lock Minutes** — How long a creator can hold exclusive control of a device.

### 2.3 Managing Devices

Devices represent physical Raspberry Pi displays. Admins register them, approve heartbeats, and configure group membership.

**Step 2.3.1 — Open the Devices page**

Click **Devices** in the admin sidebar. Three panels appear: Register form (left), the fleet list (center), and the settings inspector (right).

![Figure 10: Admin Devices page showing the registered hardware fleet.](../../docs/auto-generated/04a-devices-list.png)

*Figure 10: Admin Devices page showing the registered hardware fleet.*

---

**Step 2.3.2 — Fill the Register Device form**

Enter the **Device ID** (from the Pi's `config.py`), **Device Name**, **IP Address**, **Location**, and the **Primary Group**. Toggle **Belongs to all groups** if it should display content for every department.

![Figure 11: Register Device form filled with new hardware details.](../../docs/auto-generated/04b-devices-form-filled.png)

*Figure 11: Register Device form filled with new hardware details.*

---

**Step 2.3.3 — Register and verify**

Click **Register**. The device joins the list with status `online` as soon as its agent sends a heartbeat.

![Figure 12: Device list immediately after registering a new display.](../../docs/auto-generated/04c-devices-created.png)

*Figure 12: Device list immediately after registering a new display.*

---

**Step 2.3.4 — Inspect a device**

Click any row in the list to load its **Settings** panel on the right. You can rename it, change groups, view sensor logs, upload an **Emergency Asset**, or erase it from the fleet.

> 🖼️ *Screenshot pending:* `04d-device-selected.png` — Device Settings panel after selecting a row.

*Figure 13: Device Settings panel after selecting a row.*

---

**Current fleet:**

| ID | Name | Location | IP Address | Primary Group | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | ECE-Lobby-Signage | Building 5, Main Entrance | 10.42.5.101 | ECE Department | online |
| 2 | Library-Entry-F1 | Central Library South Lobby | 10.42.12.50 | Main Library | online |
| 3 | Union-Cafe-Menu | Student Union, Ground Floor | 10.42.8.20 | Student Union | online |
| 4 | Security-Monitor-01 | Admin Block B, Room 102 | 10.42.1.15 | Campus Security | online |
| 5 | IT-Service-Display | Tech Tower, Room 204 | 10.42.15.110 | IT Services | online |
| 6 | ECE-Lab-302-Status | Building 5, Lab 302 | 10.42.5.202 | ECE Department | online |
| 7 | Library-Quiet-Zone | Library 3rd Floor Wing | 10.42.12.88 | Main Library | offline |
| 8 | North-Gate-Totem | Campus North Entrance | 10.42.0.5 | Emergency Broadcast | online |
| 9 | Dining-Hall-A-Promo | Central Dining Hall | 10.42.10.12 | Dining Services | online |
| 10 | Faculty-Lounge-TV | Building 5, Room 501 | 10.42.5.50 | ECE Department | offline |

## 3. Content Creation

Creators write posts, design visual slides, publish them to signage, and manage live streams.

### 3.1 Creating a Post

Posts are markdown documents with optional images, attachments, and live-stream bindings. They can target multiple groups and be published to the feed, signage, or both.

**Step 3.1.1 — Log in as a creator and open the dashboard**

Sign in with a creator account (e.g. `prof.thompson` / `CreatorPass123!`). You land on the Creator Dashboard, which summarises your recent posts and signage activity.

![Figure 14: Creator Dashboard immediately after login.](../../docs/auto-generated/05a-creator-dashboard.png)

*Figure 14: Creator Dashboard immediately after login.*

---

**Step 3.1.2 — Open the Posts page**

Click **Posts** in the creator sidebar. The left card is the **New Post** editor; the right side lists your existing posts with filters for channel, group, and creator.

![Figure 15: Creator Posts page with the new-post editor and post list.](../../docs/auto-generated/05b-posts-list.png)

*Figure 15: Creator Posts page with the new-post editor and post list.*

---

**Step 3.1.3 — Write title and description**

Enter a **Title** and write the body in **Markdown** in the description textarea. Use headings, lists, and bold text — they render in the public feed and on the signage detail view.

![Figure 16: New Post form with title and markdown description entered.](../../docs/auto-generated/05c-posts-form-filled.png)

*Figure 16: New Post form with title and markdown description entered.*

---

**Step 3.1.4 — Upload media**

Click the file picker to add an **Image** (shown on signage/feed) or an **Attachment** (downloadable PDF/Office file). The crop modal lets you pick the focal area.

![Figure 17: New Post form after uploading an image.](../../docs/auto-generated/05d-posts-image-uploaded.png)

*Figure 17: New Post form after uploading an image.*

---

**Step 3.1.5 — Save the post**

Click **Save Post**. If you have *auto-approve* the post is pre-authorised, but it still starts as a **draft** — publish it explicitly when ready.

![Figure 18: Posts list showing the newly created post.](../../docs/auto-generated/05e-posts-saved.png)

*Figure 18: Posts list showing the newly created post.*

---

**Sample posts in this dataset:**

| # | Title | Creator | Groups | State | Media |
| --- | --- | --- | --- | --- | --- |
| 1 | 🚨 EMERGENCY: SEVERE WEATHER ALERT | Chief Robert Miller | Emergency Broadcast | EMERGENCY | Text |
| 2 | 🎓 ECE Research Symposium 2026 | Prof. James Thompson | ECE Department | NORMAL | Image |
| 3 | 🧪 Lab Safety & Calibration Guide | Prof. James Thompson | ECE Department | NORMAL | PDF |
| 4 | 🍔 Today's Lunch Special: Tech Tower Burger | Samantha Lee | Dining Services | NORMAL | Image |
| 5 | Spring 2026 Dining Hall Menu | Samantha Lee | Dining Services | NORMAL | PDF |
| 6 | 📽️ Campus Tour (Live Feed) | Kevin Zhang | Student Union | NORMAL | Live Stream |

### 3.2 Adding Attachments to an Existing Post

**Important constraint**: PDFs and Office files can only be uploaded to a post that has *already been saved at least once*. The Attachments card is **disabled** while you are still creating a brand-new post — the placeholder text reads *"Save post first to add attachments."*

**Step 3.2.1 — Open an existing post for editing**

On the **Posts** page, locate the post you want to enrich and click its **edit (pencil) button** on the right side of the row. The form on the left switches from *New Post* to *Edit Post* and now shows your saved values.

![Figure 19: Posts page with the Edit Post form active for an existing post.](../../docs/auto-generated/16a-post-edit-open.png)

*Figure 19: Posts page with the Edit Post form active for an existing post.*

---

**Step 3.2.2 — Locate the Attachments card**

Scroll inside the editor card until you see the **Attachments** section. While editing an existing post, the card becomes interactive and shows an *Add attachment* file picker plus a list of any attachments already attached.

![Figure 20: Attachments card unlocked for an existing post.](../../docs/auto-generated/16b-post-attachments-card.png)

*Figure 20: Attachments card unlocked for an existing post.*

---

**Step 3.2.3 — Upload a PDF**

Click the file picker and choose a PDF or Office document (max 5 attachments per post). The backend extracts text content from the file so the AI assistant can answer questions about it later.

![Figure 21: Post editor after a PDF attachment has been uploaded.](../../docs/auto-generated/16c-post-attachment-uploaded.png)

*Figure 21: Post editor after a PDF attachment has been uploaded.*

---

### 3.3 Using the Visual Designer

The designer lets creators build slides with text, shapes, and images on a **Fabric.js** canvas. The result is exported as a JPEG that you can attach to a post.

**Step 3.3.1 — Open the Editor**

From the creator sidebar, click **Signage Designer**. The canvas starts blank; the mode toggle at the top selects between **Visual** (default) and **Markdown slide**.

![Figure 22: Creator Editor with an empty visual canvas.](../../docs/auto-generated/06a-designer-empty.png)

*Figure 22: Creator Editor with an empty visual canvas.*

---

**Step 3.3.2 — Apply a template**

Pick a starter template such as **Big headline**, **Lower third**, **Split panel**, or **Hours / list**. The canvas populates with placeholder text and shapes you can customise.

![Figure 23: Canvas after applying a headline template.](../../docs/auto-generated/06b-designer-template.png)

*Figure 23: Canvas after applying a headline template.*

---

**Step 3.3.3 — Add and style elements**

Use the toolbar to add **Text**, rectangles, circles, or upload images. Customise colours, fonts, and positions. Click **Use this slide** to export the design as a JPEG that can be attached to a post.

![Figure 24: Canvas after adding custom text elements.](../../docs/auto-generated/06c-designer-text.png)

*Figure 24: Canvas after adding custom text elements.*

---

### 3.4 Markdown Slide Designer

If you prefer typing over dragging shapes, switch the designer into **Markdown** mode. Your markdown is rendered live with KaTeX support for math and exported as a JPEG sized for the chosen TV preset.

**Step 3.4.1 — Switch to Markdown mode**

Click the **Markdown** toggle at the top of the designer. The canvas is replaced by a textarea on the left and a live-preview panel on the right.

![Figure 25: Designer in markdown mode with an empty editor.](../../docs/auto-generated/14a-designer-md-empty.png)

*Figure 25: Designer in markdown mode with an empty editor.*

---

**Step 3.4.2 — Write your slide**

Type in standard markdown — headings, lists, **bold**, math like `$E=mc^2$`, even tables. Adjust font size, font family, and colours via the right-hand toolbar. The preview reflows automatically as you type.

![Figure 26: Designer with a markdown slide fully written and rendered live.](../../docs/auto-generated/14b-designer-md-filled.png)

*Figure 26: Designer with a markdown slide fully written and rendered live.*

---

### 3.5 Publishing to Signage

After a post exists, it must be explicitly published to selected devices. The backend then pushes a real-time sync command via Socket.IO so every targeted Pi updates within seconds.

**Step 3.5.1 — Open the Signage page**

Click **Signage** in the creator sidebar. You see a list of your publishable posts on the left and the devices in your groups on the right.

![Figure 27: Signage Publish page listing posts and target devices.](../../docs/auto-generated/07a-signage-list.png)

*Figure 27: Signage Publish page listing posts and target devices.*

---

**Step 3.5.2 — Select post and devices**

Pick a **Post** from the dropdown and tick the **Devices** that should display it. Set a **Duration** (seconds per slide) and a **Priority** to control rotation order.

![Figure 28: Post and devices selected for publishing.](../../docs/auto-generated/07b-signage-select.png)

*Figure 28: Post and devices selected for publishing.*

---

**Step 3.5.3 — Publish**

Click **Publish**. The targeted Pi devices receive an instant `signage_sync` event over Socket.IO, download any new media, and add the slide to their rotation. A confirmation banner appears at the top of the page.

![Figure 29: Signage page after a successful publish.](../../docs/auto-generated/07c-signage-published.png)

*Figure 29: Signage page after a successful publish.*

---

### 3.6 Live Streams — Full Lifecycle

Live streams come in four flavours: **HLS** (`.m3u8` URL), **RTSP** (IP camera), **YouTube Live**, and **RTMP** (OBS ingest). Once created, a stream can be attached to a post just like an image — signage devices play the live feed instead of static media. This section covers create, edit, start/stop, and inspect.

**Step 3.6.1 — Open the Live Streams page**

Click **Live Streams** in the creator sidebar. Existing streams appear in a list, each showing its source URL, status (online/offline/error), and per-row action buttons.

![Figure 30: Live Streams page with the list of existing streams.](../../docs/auto-generated/08a-livestream-list.png)

*Figure 30: Live Streams page with the list of existing streams.*

---

**Step 3.6.2 — Configure a new stream**

Enter the **Title**, choose a **Stream Type** (RTSP/HLS/YouTube/RTMP), paste the **Source URL** (omitted for RTMP, which generates its own ingest endpoint), and select the **Group** that owns it.

![Figure 31: Live stream creation form filled with source details.](../../docs/auto-generated/08b-livestream-form.png)

*Figure 31: Live stream creation form filled with source details.*

---

**Step 3.6.3 — Save the stream**

Click **Save**. The stream now appears in the list and becomes selectable from the post editor's *Use live stream* option. After saving you can also upload a **thumbnail** for the post preview.

![Figure 32: Live Streams list after creating a new stream.](../../docs/auto-generated/08c-livestream-created.png)

*Figure 32: Live Streams list after creating a new stream.*

---

**Step 3.6.4 — Edit an existing stream**

Click the **Edit** button on any stream row. The form on the left flips to *Edit Live Stream* and is pre-populated with the saved values. Update any field and click **Update Stream** to apply the change without affecting active deployments.

![Figure 33: Live stream edit form populated with the saved values of an existing stream.](../../docs/auto-generated/17b-livestream-edit.png)

*Figure 33: Live stream edit form populated with the saved values of an existing stream.*

---

**Step 3.6.5 — Start, stop, and inspect**

Use the **Start / Stop** buttons (RTSP/YouTube/RTMP) to control the relay. Click **Details** on a row to expand a panel showing the source URL, the public HLS relay URL, the stream key, last-seen timestamp, and recent error logs. **Refresh** re-pulls the most recent log lines.

![Figure 34: Expanded details panel of a live stream with source/relay URLs and logs.](../../docs/auto-generated/17c-livestream-details.png)

*Figure 34: Expanded details panel of a live stream with source/relay URLs and logs.*

---

## 4. Public Feed & AI Assistant

The public feed at **`/feed`** shows every post marked **Allowed on Feed** with **Published** status. No login is required. Visitors can also chat with an **AI assistant** that has been grounded on the post's markdown body and any attached PDF/Office files.

### 4.1 Browsing the Feed

**Step 4.1.1 — Open the feed**

Navigate to **`/feed`** in any browser. Posts are sorted by priority and recency. Each card shows the title, hero image, group, and creator.

![Figure 35: Public feed showing all campus announcements.](../../docs/auto-generated/09a-feed.png)

*Figure 35: Public feed showing all campus announcements.*

---

**Step 4.1.2 — Open a post detail**

Click any card to open the detail view at **`/post/:id`**. The full markdown body, all images, and any attached PDFs are rendered. Live streams play inline when available.

> 🖼️ *Screenshot pending:* `09b-post-detail.png` — Post detail page showing full content and media.

*Figure 36: Post detail page showing full content and media.*

---

### 4.2 Asking the AI Assistant about a Post

Each post detail page surfaces a floating **AI chat** widget in the bottom-right corner. The assistant is grounded on the post's text body **and** the extracted text of every attachment, so it answers contextually — not generically.

**Step 4.2.1 — View the post detail page**

From `/feed`, click any post. The detail page renders the full markdown body, hero image, attachments list, and the floating AI chat button.

![Figure 37: Post detail page with the floating AI chat button visible bottom-right.](../../docs/auto-generated/15a-post-detail-full.png)

*Figure 37: Post detail page with the floating AI chat button visible bottom-right.*

---

**Step 4.2.2 — Open the AI chat**

Click the **AI** button in the bottom-right corner. A resizable chat window slides up. The assistant first verifies that the post has enough context (markdown body or attachments) before allowing questions.

![Figure 38: AI chat window opened on a post detail page.](../../docs/auto-generated/15b-post-ai-chat-open.png)

*Figure 38: AI chat window opened on a post detail page.*

---

**Step 4.2.3 — Ask a question**

Type a question in plain English and click **Send** (or press Enter). The assistant streams an answer back, with markdown formatting and code blocks rendered inline. Use the **Stop** button to interrupt a long response, and the **Copy** button on any answer to put it on your clipboard.

![Figure 39: AI chat after a sample question has been typed.](../../docs/auto-generated/15c-post-ai-question.png)

*Figure 39: AI chat after a sample question has been typed.*

---

## 5. Emergency Procedures

Emergency mode is a **group-level** state. When a group's signage state is set to **EMERGENCY**, every approved device in that group immediately overrides its normal playlist with the local emergency fallback asset and the corresponding emergency post.

**Triggers:**

- **Hardware button** — pressing the emergency button on any Raspberry Pi broadcasts to all devices in its group via Socket.IO.
- **Admin action** — flipping a group's **Signage State** to `EMERGENCY` in the admin UI.

**Step 5.1 — Mark a group as EMERGENCY (admin)**

Open **Admin → Groups**, locate the affected group, change its **Display mode** dropdown to `EMERGENCY`, and click the red **🚨 Emergency** button to confirm.

![Figure 40: Groups page showing the Emergency Broadcast group in EMERGENCY state.](../../docs/auto-generated/10a-emergency-groups.png)

*Figure 40: Groups page showing the Emergency Broadcast group in EMERGENCY state.*

---

**Step 5.2 — Verify the emergency post on the feed**

Visit **`/feed`** and open the emergency alert post. The detail page highlights the urgency and shows the canonical emergency message displayed on every device.

> 🖼️ *Screenshot pending:* `10b-emergency-post.png` — Emergency alert post detail view in EMERGENCY state.

*Figure 41: Emergency alert post detail view in EMERGENCY state.*

---

**To clear an emergency**, return to **Admin → Groups**, edit the affected group, and change its **Display mode** back to **NORMAL**. The backend emits an `emergency_mode_end` signal and all devices in the group resume normal rotation. Editing or deleting individual posts does **not** affect the group's emergency state.

## 6. Editing Existing Entities

Most admin pages list entities in a table on the right and offer the *create* form on the left. Editing is done **inline** on each row (groups, users) or by clicking a row to load a dedicated **Settings** panel (devices). This section walks through each.

### 6.1 Editing a Group (toggling Emergency)

Beyond renaming or rewriting the description, the most consequential edit on a group is changing its **Signage State**. Toggling to `EMERGENCY` immediately overrides every device in the group; toggling back to `NORMAL` resumes regular playback.

**Step 6.1.1 — Open the Groups page**

Navigate to **Admin → Groups**. The right panel shows the existing groups, each with its current state, member count, and inline editing controls.

![Figure 42: Groups page with all groups listed and their current states.](../../docs/auto-generated/11a-groups-table.png)

*Figure 42: Groups page with all groups listed and their current states.*

---

**Step 6.1.2 — Change a group's signage state**

On any row, use the **Display Mode** dropdown to pick a state (`NORMAL`, `BREAKING_NEWS`, `SECURITY_RISK`, `EMERGENCY`). The change is saved as soon as you select an option — no separate save button is required.

![Figure 43: Inline state dropdown of an existing group.](../../docs/auto-generated/11b-groups-edit-state.png)

*Figure 43: Inline state dropdown of an existing group.*

---

**Step 6.1.3 — Trigger Emergency**

Use the dedicated **🚨 Emergency** button on a group row to flip the state to `EMERGENCY` with a confirmation dialog. To clear all active emergencies at once, use the **Clear all emergencies** button at the top of the page.

![Figure 44: Emergency button on a group row.](../../docs/auto-generated/11c-groups-emergency-btn.png)

*Figure 44: Emergency button on a group row.*

---

### 6.2 Editing a User

User accounts are edited inline from the Users table. You can change the **role**, **primary group**, **auto-approve** flag, **max signage state**, **creator priority**, and **control-lock minutes** without opening a separate page.

**Step 6.2.1 — Open the Users page**

Navigate to **Admin → Users**. The right panel lists all accounts with inline editing controls in each cell.

![Figure 45: Users page with the full account roster.](../../docs/auto-generated/12a-users-table.png)

*Figure 45: Users page with the full account roster.*

---

**Step 6.2.2 — Edit a row in place**

Click any cell to edit it. Common edits: changing **Role** (creator ↔ admin), updating the **Primary Group**, toggling **Auto-approve**, setting **Creator Priority** (lower number = higher priority in signage rotation), or changing **Max Signage State** (cap on how urgent a creator's posts can be).

![Figure 46: User table with a row ready for inline edits.](../../docs/auto-generated/12b-users-row-detail.png)

*Figure 46: User table with a row ready for inline edits.*

---

### 6.3 Editing a Device & Uploading the Emergency Asset

Devices have the richest edit panel: name, IP, location, primary group, additional groups, *all-groups* flag, plus three **action buttons** (Save, Reset to Defaults, Erase & Remove) and an **Emergency Asset** uploader. Selecting a row in the device list loads its full settings on the right.

**Step 6.3.1 — Select a device**

Navigate to **Admin → Devices**. Click any row in the centre list to load its settings on the right. Pending registrations and pending remote-identity changes appear as a banner at the top of the panel with **Approve** / **Reject** buttons.

![Figure 47: Device Settings panel after selecting a row.](../../docs/auto-generated/13a-device-settings.png)

*Figure 47: Device Settings panel after selecting a row.*

---

**Step 6.3.2 — Update settings or remove**

Edit the form fields and click **Save Device** to persist. **🔄 Reset to Agent Defaults** clears server-side overrides so the device picks up its own `config.py` values on next heartbeat. **🗑️ Erase & Remove Device** wipes all images from the TV and removes the device entirely — irreversible.

![Figure 48: Device action buttons: Save, Reset, and Erase.](../../docs/auto-generated/13b-device-actions.png)

*Figure 48: Device action buttons: Save, Reset, and Erase.*

---

**Step 6.3.3 — Upload the Emergency Asset**

Each device can have a **dedicated emergency image or video** stored locally on the Pi. When the group enters EMERGENCY mode, this asset is the override that plays immediately. Use the file picker in the red Emergency Asset card and click **Upload Emergency Asset** to install it. The current asset path is shown above the picker.

![Figure 49: Device Emergency Asset upload card.](../../docs/auto-generated/13c-device-emergency-asset.png)

*Figure 49: Device Emergency Asset upload card.*

---

## Appendix A: Mock University Data

Raw fixture data used to seed this database and generate the screenshots above.

### A.1 Users

| ID | Username | Role | Primary Group | Managed Groups | Auto Approve | Max State |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | admin.root | admin | ECE Department | ECE Department, IT Services, Main Library | Yes | EMERGENCY |
| 2 | prof.thompson | creator | ECE Department | ECE Department, Emergency Broadcast | No | NORMAL |
| 3 | lib.director | creator | Main Library | Main Library, Student Union | No | NORMAL |
| 4 | su.events | creator | Student Union | Student Union, Dining Services | No | NORMAL |
| 5 | it.manager | creator | IT Services | IT Services, Emergency Broadcast | No | NORMAL |
| 6 | security.lead | creator | Campus Security | Campus Security, Emergency Broadcast | Yes | EMERGENCY |
| 7 | dining.coord | creator | Dining Services | Dining Services, Student Union | No | NORMAL |

### A.2 Groups

| ID | Name | Description | State |
| --- | --- | --- | --- |
| 1 | ECE Department | Electrical & Computer Engineering - academic news, lab schedules, and faculty notices. | NORMAL |
| 2 | Main Library | Public signage for the main campus library, study room availability, and event alerts. | NORMAL |
| 3 | Student Union | Student activity center, club announcements, and general campus life updates. | NORMAL |
| 4 | Campus Security | Security alerts, lost & found, and emergency protocol communications. | EMERGENCY |
| 5 | IT Services | System status updates, help desk hours, and technology workshops. | NORMAL |
| 6 | Dining Services | Menu boards for campus cafeterias, nutrition info, and dining hours. | NORMAL |
| 7 | Emergency Broadcast | Highest priority group for campus-wide emergency alerts and critical safety info. | EMERGENCY |

### A.3 Devices

| ID | Name | Location | IP | Groups | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | ECE-Lobby-Signage | Building 5, Main Entrance | 10.42.5.101 | ECE Department, Emergency Broadcast | online |
| 2 | Library-Entry-F1 | Central Library South Lobby | 10.42.12.50 | Main Library, Emergency Broadcast | online |
| 3 | Union-Cafe-Menu | Student Union, Ground Floor | 10.42.8.20 | Student Union, Dining Services | online |
| 4 | Security-Monitor-01 | Admin Block B, Room 102 | 10.42.1.15 | Campus Security, Emergency Broadcast | online |
| 5 | IT-Service-Display | Tech Tower, Room 204 | 10.42.15.110 | IT Services, ECE Department | online |
| 6 | ECE-Lab-302-Status | Building 5, Lab 302 | 10.42.5.202 | ECE Department | online |
| 7 | Library-Quiet-Zone | Library 3rd Floor Wing | 10.42.12.88 | Main Library | offline |
| 8 | North-Gate-Totem | Campus North Entrance | 10.42.0.5 | Emergency Broadcast, Student Union | online |
| 9 | Dining-Hall-A-Promo | Central Dining Hall | 10.42.10.12 | Dining Services, Emergency Broadcast | online |
| 10 | Faculty-Lounge-TV | Building 5, Room 501 | 10.42.5.50 | ECE Department, Emergency Broadcast | offline |

### A.4 Posts

| ID | Title | Creator | Groups | State | Feed | Signage | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 🚨 EMERGENCY: SEVERE WEATHER ALERT | Chief Robert Miller | Emergency Broadcast | EMERGENCY | No | Yes | 100 |
| 2 | 🎓 ECE Research Symposium 2026 | Prof. James Thompson | ECE Department | NORMAL | Yes | Yes | 10 |
| 3 | 🧪 Lab Safety & Calibration Guide | Prof. James Thompson | ECE Department | NORMAL | No | Yes | 5 |
| 4 | 🍔 Today's Lunch Special: Tech Tower Burger | Samantha Lee | Dining Services | NORMAL | Yes | Yes | 1 |
| 6 | Spring 2026 Dining Hall Menu | Samantha Lee | Dining Services | NORMAL | No | No | 1 |
| 5 | 📽️ Campus Tour (Live Feed) | Kevin Zhang | Student Union | NORMAL | No | Yes | 1 |

## Appendix B: Sample AI Conversations

These question-and-answer pairs are the canonical fixtures the **Post AI Assistant** is benchmarked against. Each scenario is bound to one of the seeded posts via its `scenario_id` and exercises the assistant's ability to reason over the post body and any attached PDFs.

### doc-sample-1 — ECE Research Symposium

> **Q:** What is the main topic of this post?
> **A:** This post announces the **Annual ECE Research Symposium 2026**, taking place March 15 in the Main Hall. The agenda covers six research tracks ranging from embedded AI to power electronics, with two keynote speakers.

> **Q:** Who can attend the symposium?
> **A:** It is open to faculty, graduate students, and invited industry partners. Undergraduates are welcome at the afternoon poster session in the atrium.

> **Q:** Is there a registration fee?
> **A:** No. The symposium is free for all university members, but registration is required by Friday so catering numbers can be confirmed.

> **Q:** Where can I park if I am visiting from outside campus?
> **A:** Visitor parking is available in **Lot D**, directly across from the Main Hall entrance. The QR code on the signage opens a printable visitor pass.

### doc-sample-2 — Lab Safety & Calibration Guide

> **Q:** How do I report a maintenance issue?
> **A:** Scan the QR code on the side of any signage display. It opens the IT Services maintenance portal with the device ID pre-filled.

> **Q:** What PPE is required to enter Lab 302?
> **A:** A lab coat, safety goggles, and closed-toe shoes are mandatory at all times. Nitrile gloves are required for any chemical handling, and heat-resistant gloves are required when operating the furnace.

> **Q:** What are the lab hours on weekends?
> **A:** The lab is closed on Sundays. Saturday hours are 10:00 to 16:00, and only authorised personnel may use the lab outside those windows.

> **Q:** Where is the calibration log stored?
> **A:** Calibration logs are stored on the lab share at `\\labshare\ECE302\calibration\<YYYY-MM>\`. Each device has a sub-folder named after its asset tag.

### doc-sample-3 — Dining Hall Spring Menu

> **Q:** Are there vegan options on Tuesday?
> **A:** Yes. Tuesday's dinner — **Lentil Shepherd's Pie** — is fully vegan. Vegan substitutions are also available at the build-your-own bowl station every weekday.

> **Q:** What time does dinner end on weekends?
> **A:** Weekend dinner service ends at **20:00**. Weekday dinner runs until 21:00.

> **Q:** Does the Tech Tower Burger contain dairy?
> **A:** Yes — the Tech Tower Burger includes a brioche bun (dairy + gluten) and aged cheddar (dairy). A dairy-free version with a sourdough bun and vegan cheese can be ordered at the grill station.

### doc-sample-4 — Emergency Severe Weather Alert

> **Q:** What should I do if I am off-campus when this alert is issued?
> **A:** Do not travel to campus. Wait for an `emergency_mode_end` notification (push or SMS) before resuming your normal schedule. Faculty: contact your department chair if you are mid-class.

> **Q:** How long does emergency mode typically last?
> **A:** Emergency mode persists until an admin manually clears it via **Admin → Groups**. Hardware-triggered emergencies (button press on a Pi) follow the same rule — they only clear when an admin sets the group's signage state back to NORMAL.

