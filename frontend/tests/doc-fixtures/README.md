# 📖 Automated Manual Documentation System

This directory contains the **Doc-as-Code** pipeline that generates the user manual for the WebServerSignage project.

Instead of manual screenshots, a Playwright script walks through every UI flow, captures screenshots at each interaction, and a Node script assembles those images into a step-by-step markdown manual with captions and instructions.

---

## 📂 Directory Layout

```
frontend/tests/doc-fixtures/
├── README.md                          # ← you are here
├── seed.js                            # Idempotent DB seeder (uses real API)
├── generate-pdfs.js                   # Pandoc + Chromium PDF generator
├── create_manual.js                   # Assembles screenshots into USER_MANUAL.md
├── users-sample.json                  # Mock accounts (admin + creators)
├── groups-sample.json                 # Mock departments / units
├── devices-sample.json                # Mock Pi displays
├── posts-sample.json                  # Mock posts, images, live streams
├── ai/
│   └── mock-conversations.json        # Q&A pairs that ground the AI assistant
├── media/
│   ├── campus-hero.jpg
│   ├── event-flyer.jpg
│   ├── safety-guide.pdf               # Generated via pandoc + Chromium
│   ├── dining-menu.pdf                # Generated via pandoc + Chromium
│   └── ...
├── markdown/
│   ├── safety-guide-print.md          # Pandoc source for the PDF above
│   ├── dining-menu-print.md           # Pandoc source for the PDF above
│   └── ...
└── USER_MANUAL.md                     # Final assembled manual
```

---

## 🏗️ Mock University Architecture

### Identity & Access (`users-sample.json`)
| Role | Username | Password | Display Name | Primary Group |
|---|---|---|---|---|
| admin | `admin.root` | `AdminPass123!` | Dr. Sarah Mitchell | IT Services |
| creator | `prof.thompson` | `CreatorPass123!` | Prof. James Thompson | ECE Department |
| creator | `lib.director` | `CreatorPass123!` | Lisa Chen | Main Library |
| creator | `su.events` | `CreatorPass123!` | Marcus Johnson | Student Union |
| creator | `it.manager` | `CreatorPass123!` | Robert Miller | IT Services |
| creator | `security.lead` | `CreatorPass123!` | Chief Robert Miller | Campus Security |
| creator | `dining.coord` | `CreatorPass123!` | Samantha Lee | Dining Services |

### Organisational Groups (`groups-sample.json`)
7 groups (ECE Department, Main Library, Student Union, Campus Security, IT Services, Dining Services, Emergency Broadcast), each with a `signage_state` (`NORMAL` or `EMERGENCY`).

### Hardware Fleet (`devices-sample.json`)
10 Raspberry Pi devices with primary group, additional groups, IP, location, approval state, and sensor data.

### Content (`posts-sample.json`)
6 scenarios covering emergency alerts, academic events, lab safety guides (with PDF attachments), dining menus, and live streams. One post is deliberately saved as a **draft** so the manual can demonstrate the "save first, then attach" workflow.

---

## ⚙️ Prerequisites

1. **Backend running** on `http://localhost:5000` (the default in the codebase).
2. **Frontend Vite dev server** running (or at least reachable at `http://localhost:5173`).
3. **Pandoc** installed (`pandoc --version` should work).
4. **Playwright browsers** installed (`npx playwright install chromium`).
5. A clean database (or the seeder is idempotent — safe to re-run).

---

## 🚀 Generating the Manual (Quick)

All commands assume you are in the `frontend/` directory.

### 1. Generate PDF fixtures (pandoc + Chromium)

```bash
node tests/doc-fixtures/generate-pdfs.js
```

This converts every `markdown/*-print.md` file into a styled PDF under `media/` using Pandoc to HTML, then Playwright Chromium to print-to-PDF. No LaTeX or wkhtmltopdf required.

### 2. Seed the database

```bash
node tests/doc-fixtures/seed.js
```

- Logs in as `admin.root`, creates groups, users, devices, posts, live streams, and uploads images / PDF attachments.
- **Idempotent**: re-running skips anything that already exists.
- **Attachment upload** happens *after* each post is saved, because the backend requires a `postId` before it can accept file attachments.

### 3. Capture step-by-step screenshots

```bash
npx playwright test --config=playwright.docs.config.js
```

- Uses `playwright.docs.config.js` (not the default `playwright.config.js`).
- The docs config:
  - Targets the **running dev backend** on port 5000.
  - Reuses an existing Vite server on port 5173.
  - Runs only `generate_docs.spec.js`.
  - Serialises tests so screenshots are deterministic.
- Screenshots land in `frontend/docs/auto-generated/`.
- **17 tests** cover:
  1. Login flow (empty → filled → dashboard)
  2. Admin groups (create)
  3. Admin users (register)
  4. Admin devices (register)
  5. Creator posts (new post)
  6. Visual designer (canvas → template → text)
  7. Signage publishing (select post + devices)
  8. Live streams (create)
  9. Public feed (browse)
  10. Emergency procedures (group state + alert detail)
  11. **Edit group state (emergency toggle)**
  12. **Edit user (inline)**
  13. **Edit device (settings + emergency asset)**
  14. **Markdown designer mode**
  15. **Post detail + AI assistant chat**
  16. **Attachment upload to existing post**
  17. **Live stream lifecycle (edit / details)**

### 4. Assemble the manual

```bash
node tests/create_manual.js
```

- Reads every screenshot in `docs/auto-generated/`.
- Produces `tests/doc-fixtures/USER_MANUAL.md` with:
  - Numbered steps, instructions, figure captions, and TOC.
  - Sections for **Login**, **Admin** (groups/users/devices), **Creator** (posts/designer/signage/live streams), **Public Feed & AI Assistant**, **Emergency**, **Editing Existing Entities**, and two appendices.

---

## � Regenerating Everything (Clean Slate)

If you want a completely fresh manual from scratch:

```bash
# 1. Wipe old screenshots
rmdir /s /q docs\auto-generated
mkdir docs\auto-generated

# 2. Wipe old PDF fixtures
del tests\doc-fixtures\media\*.pdf

# 3. Re-generate PDFs, seed, screenshot, assemble
node tests/doc-fixtures/generate-pdfs.js
set DOC_SEED=1 && npx playwright test --config=playwright.docs.config.js
node tests/create_manual.js
```

(If the DB already contains the mock data you can skip `set DOC_SEED=1` and just run Playwright; the spec does not re-seed by default.)

---

## ⚠️ Important Constraints

### Attachments require an existing post
The **Attachments** card in the post editor is **disabled** while you are creating a brand-new post. You must:
1. Save the post first (title + description + hero image).
2. Click the edit (pencil) button on the saved row.
3. Only then will the Attachments card unlock and allow PDF/Office uploads.

This is enforced by the backend: `POST /posts/:id/attachments` requires a valid `postId`, so the manual demonstrates the correct workflow in **Section 3.2** and **Test 16**.

### No LaTeX required for PDFs
`generate-pdfs.js` uses **Pandoc** to convert markdown → HTML, then **Playwright Chromium** to print the HTML → PDF. This avoids installing `pdflatex` or `wkhtmltopdf`.

---

## 🖼️ Media & Scenario Match-up

| Story | Markdown | Media Asset | AI Context | Section |
|---|---|---|---|---|
| Emergency Alert | `emergency-alert.md` | — | — | 5 |
| ECE Symposium | `rich-sample.md` | `campus-hero.jpg` | `doc-sample-1` | 3.1 |
| Lab Safety | `safety-guide-print.md` | `safety-guide.pdf` | `doc-sample-2` | 3.2 / 4.2 |
| Dining Menu | `dining-menu-print.md` | `dining-menu.pdf` | `doc-sample-3` | 3.2 |
| Live Campus Tour | — | RTSP stream | — | 3.6 |

---

## 🤖 AI Alignment

`ai/mock-conversations.json` contains canonical Q&A pairs for each seeded post scenario. The Post AI Assistant is grounded on:
- The post's `description_markdown_file` body.
- Text extracted from every uploaded PDF / Office attachment (via `pdf-parse`, `mammoth`, and `xlsx`).

This means a visitor asking *"Where is the calibration log stored?"* about the Lab Safety post will receive an answer extracted from the PDF, not a generic hallucination. The manual documents this interaction in **Section 4.2**.
