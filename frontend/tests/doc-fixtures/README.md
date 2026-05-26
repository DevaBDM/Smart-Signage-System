# 📖 Automated Manual Documentation System

This directory contains the **High-Fidelity Mock Data Environment** used to generate professional user manuals for the WebServerSignage project. 

Instead of manual screenshots, this system uses a "Doc-as-Code" approach. A Playwright script orchestrates a perfectly synchronized campus environment to capture clean, consistent, and contextually accurate screenshots for the final user guide.

---

## 🏗️ The "Mock University" Architecture

This setup simulates a real-world university deployment with the following entities:

### 👤 Identity & Access (`users-sample.json`)
- **Admin**: `Dr. Sarah Mitchell` (`admin.root`, id=1).
- **Creators**: 6 distinct users including `Chief Robert Miller` (Security, id=6), `Prof. Thompson` (ECE, id=2), and `Samantha Lee` (Dining, id=7).
- **Primary Group** (`group_id`): Every user belongs to exactly one home department.
- **Managed Groups** (`managed_group_ids`): Additional cross-department access for RBAC.
- **Permissions**: `auto_approve`, `can_manage_other_posts`, `max_signage_state`, `control_lock_minutes`.

### 📁 Organizational Structure (`groups-sample.json`)
- 7 core groups with explicit integer IDs (1–7) including **Emergency Broadcast**, **ECE Department**, and **Dining Services**.
- Each group has a `signage_state` (NORMAL or EMERGENCY) reflecting its default urgency posture.
- Used to demonstrate how content is siloed or shared across the campus.

### 🖥️ Hardware Fleet (`devices-sample.json`)
- 10 Raspberry Pi devices with realistic names like `ECE-Lobby-Signage` and `Union-Cafe-Menu`.
- Each device has a **primary group** (`group_id`) and optional **additional groups** (`group_ids`), plus `all_groups` flag.
- Fields: `device_name`, `ip_address`, `location`, `status` (online/offline), `is_approved`.
- Removed obsolete fields (`mac_address`, `resolution`) that are not part of the backend schema.

### 📝 Content & Deployment (`posts-sample.json`)
- Connects **Creator ID** → **Markdown** → **Images / Attachments / Live Stream** → **Group IDs** → **Device IDs**.
- Uses real DB field names: `created_by` (int), `group_ids` (int[]), `device_ids` (int[]), `description_markdown_file`, `status`, `allowed_on_signage`, `allowed_on_feed`, `priority`, `duration_seconds`.
- Features 5 "Gold Standard" scenarios:
    1. **Emergency Alert**: High-priority override (EMERGENCY state) on Emergency Broadcast group.
    2. **Academic Symposium**: Departmental news with hero image (`campus-hero.jpg`).
    3. **Technical Lab Guide**: Device-specific deployment with LaTeX math and PDF attachment (`safety-guide.pdf`).
    4. **Dining Menu**: Retail-style signage with event flyer (`event-flyer.jpg`).
    5. **Live Campus Tour**: RTSP stream (`rtsp://localhost:8554/mystream`) via inline `live_stream` object.

---

## 🖼️ Media & Match-up Logic

| Story Case | Markdown Source | Media Asset | AI Context | Narrative Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **A: Emergency** | `emergency-alert.md` | N/A | (Implicit) | Global Override |
| **B: Symposium** | `rich-sample.md` | `campus-hero.jpg` | `doc-sample-1` | Group Deployment |
| **C: Lab Safety** | `math-sample.md` | `safety-guide.pdf` (attachment) | `doc-sample-2` | Device-Specific |
| **D: Dining** | `dining-special.md` | `event-flyer.jpg` | N/A | Menu Management |
| **E: Live Feed** | (N/A) | RTSP stream | N/A | RTSP Simulation |

---

## 🚀 How to Generate the Manual

1. **Prerequisites**:
   - Ensure your local RTSP stream is running at `rtsp://localhost:8554/mystream` (optional for screenshots; the script uses a placeholder).
   - Ensure the backend and frontend servers are reachable.

2. **Step 1: Seed the database** (uses the corrected fixtures):
   ```bash
   node tests/doc-fixtures/seed.js
   ```
   This populates the test DB with the mock university data via the real API.

3. **Step 2: Capture Screenshots**:
   ```bash
   npx playwright test tests/generate_docs.spec.js
   ```
   This will populate `docs/auto-generated/` with clean images.

4. **Step 3: Generate Markdown**:
   ```bash
   node tests/create_manual.js
   ```
   This will combine the screenshots and descriptive steps into a final `USER_MANUAL.md`.

---

## 🤖 AI Alignment
To ensure the AI responses in screenshots are accurate, the system mocks the `POST /api/ai/ask` endpoint using `ai/mock-conversations.json`. Conversations are keyed by `scenario_id` (matching the `scenario_id` field in `posts-sample.json`) instead of brittle string `post_id`s. This ensures that if the manual shows a user asking about "Symposium Fees," the screenshot shows the AI correctly answering "No fee."
