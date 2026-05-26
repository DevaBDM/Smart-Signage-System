/**
 * Doc-Fixture Seeding Script
 *
 * Populates the test backend with the high-fidelity mock university data
 * defined in this directory so Playwright can capture clean screenshots
 * for the user manual.
 *
 * Usage:
 *   node tests/doc-fixtures/seed.js
 *
 * Environment:
 *   API_URL - defaults to http://localhost:5000/api
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = __dirname;
const API_URL = process.env.API_URL || "http://localhost:5000/api";

async function api(method, endpoint, body, headers = {}) {
  const url = `${API_URL}${endpoint}`;
  const isForm = body instanceof FormData;
  const options = {
    method,
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
  };
  if (body && method !== "GET") {
    options.body = isForm ? body : JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(
      `${method} ${url} failed (${res.status}): ${JSON.stringify(data)}`
    );
  }
  return data;
}

function loadJson(name) {
  return JSON.parse(
    fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8")
  );
}

function readFile(rel) {
  return fs.readFileSync(path.join(FIXTURES_DIR, rel));
}

// Strip characters that aren't representable in WIN1252 (emojis, variation
// selectors, ZWJ, supplementary CJK, dingbats…) so they survive a
// WIN1252-encoded Postgres DB. Long-term, recreate the DB with UTF8.
function stripEmoji(s) {
  if (typeof s !== "string") return s;
  return s
    // Supplementary planes (emoji, CJK Ext, etc.)
    .replace(/[\u{10000}-\u{10FFFF}]/gu, "")
    // Misc symbols & dingbats
    .replace(/[\u{2300}-\u{27BF}]/gu, "")
    // Variation selectors
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    // Zero-width joiner & non-joiner
    .replace(/[\u200C\u200D]/g, "")
    // Private-use chars sometimes produced by PDF extraction
    .replace(/[\u{E000}-\u{F8FF}]/gu, "")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

async function login(username, password) {
  const data = await api("POST", "/auth/login", { username, password });
  return data.token;
}

async function seed() {
  console.log("🌱 Seeding doc-fixtures into", API_URL);

  // ── 1. Bootstrap admin (first user) ─────────────────────────────
  const users = loadJson("users-sample.json");
  const adminUser = users.find((u) => u.role === "admin");
  let adminToken;
  try {
    adminToken = await login(adminUser.username, adminUser.password);
    console.log("  ✓ Logged in as existing admin");
  } catch {
    await api("POST", "/auth/register", {
      username: adminUser.username,
      password: adminUser.password,
      role: "admin",
    });
    adminToken = await login(adminUser.username, adminUser.password);
    console.log("  ✓ Bootstrapped admin");
  }

  const auth = { Authorization: `Bearer ${adminToken}` };

  // ── 2. Groups ─────────────────────────────────────────────────────
  const groups = loadJson("groups-sample.json");
  const existingGroups = await api("GET", "/groups", null, auth).catch(() => []);
  const groupNameToId = {};
  for (const eg of existingGroups) groupNameToId[eg.name] = eg.id;
  for (const g of groups) {
    if (groupNameToId[g.name]) {
      console.log(`  • Group exists: ${g.name} (id=${groupNameToId[g.name]})`);
      continue;
    }
    const created = await api("POST", "/groups", g, auth);
    groupNameToId[created.name] = created.id;
    console.log(`  ✓ Group: ${created.name} (id=${created.id})`);
  }

  // Helper to map fixture group IDs → real DB IDs (when fixture uses sequential IDs)
  // Our fixtures now use explicit IDs that match the DB after creation in order,
  // but to be safe we map by name if we re-create them.
  const fixtureGroupIdToRealId = {};
  groups.forEach((g, i) => {
    fixtureGroupIdToRealId[g.id] = groupNameToId[g.name];
  });

  // ── 3. Users ──────────────────────────────────────────────────────
  const existingUsers = await api("GET", "/users", null, auth).catch(() => []);
  const usernameToId = {};
  for (const eu of existingUsers) usernameToId[eu.username] = eu.id;

  const userFixtureIdToRealId = {};
  for (const u of users) {
    if (usernameToId[u.username]) {
      userFixtureIdToRealId[u.id] = usernameToId[u.username];
      console.log(`  • User exists: ${u.username} (id=${usernameToId[u.username]})`);
      continue;
    }
    const payload = {
      username: u.username,
      password: u.password,
      role: u.role,
      group_id: fixtureGroupIdToRealId[u.group_id],
      auto_approve: u.auto_approve,
      can_manage_other_posts: u.can_manage_other_posts,
      creator_priority: u.creator_priority,
      control_lock_minutes: u.control_lock_minutes,
      max_signage_state: u.max_signage_state,
      managed_group_ids: u.managed_group_ids.map(
        (id) => fixtureGroupIdToRealId[id]
      ),
    };
    const created = await api("POST", "/auth/register", payload, auth);
    userFixtureIdToRealId[u.id] = created.id;
    console.log(`  ✓ User: ${created.username} (id=${created.id})`);
  }

  // ── 4. Devices ────────────────────────────────────────────────────
  const devices = loadJson("devices-sample.json");
  const existingDevices = await api("GET", "/devices", null, auth).catch(() => []);
  const deviceNameToId = {};
  for (const ed of existingDevices) deviceNameToId[ed.device_name] = ed.id;
  const deviceFixtureIdToRealId = {};
  for (const d of devices) {
    if (deviceNameToId[d.device_name]) {
      deviceFixtureIdToRealId[d.id] = deviceNameToId[d.device_name];
      console.log(`  • Device exists: ${d.device_name} (id=${deviceNameToId[d.device_name]})`);
      continue;
    }
    const payload = {
      device_name: d.device_name,
      ip_address: d.ip_address,
      location: d.location,
      group_id: fixtureGroupIdToRealId[d.group_id],
      group_ids: d.group_ids.map((id) => fixtureGroupIdToRealId[id]),
      all_groups: d.all_groups,
      is_approved: d.is_approved,
    };
    const created = await api("POST", "/devices/register", payload, auth);
    // Set status if not default
    if (d.status) {
      await api("PUT", `/devices/${created.id}`, { status: d.status }, auth);
    }
    deviceFixtureIdToRealId[d.id] = created.id;
    console.log(`  ✓ Device: ${created.device_name} (id=${created.id})`);
  }

  // ── 5. Posts ──────────────────────────────────────────────────────
  const posts = loadJson("posts-sample.json");
  for (const p of posts) {
    const creatorToken = await login(
      users.find((u) => u.id === p.created_by).username,
      users.find((u) => u.id === p.created_by).password
    );
    const creatorAuth = { Authorization: `Bearer ${creatorToken}` };

    // Live stream (create first if needed)
    let liveStreamId = null;
    if (p.live_stream) {
      const ls = await api("POST", "/live-streams", {
        title: p.live_stream.title,
        stream_type: p.live_stream.stream_type,
        source_url: p.live_stream.source_url,
        group_id: fixtureGroupIdToRealId[p.group_ids[0]],
      }, creatorAuth);
      liveStreamId = ls.id;
      console.log(`  ✓ LiveStream: ${ls.title} (id=${ls.id})`);
    }

    // Build multipart payload
    const fd = new FormData();
    fd.append("title", stripEmoji(p.title));
    fd.append("group_ids", JSON.stringify(
      p.group_ids.map((id) => fixtureGroupIdToRealId[id])
    ));
    fd.append("status", p.status);
    fd.append("signage_state", p.signage_state);
    fd.append("allowed_on_signage", String(p.allowed_on_signage));
    fd.append("allowed_on_feed", String(p.allowed_on_feed));
    fd.append("priority", String(p.priority));
    fd.append("duration_seconds", String(p.duration_seconds));

    if (p.device_ids && p.device_ids.length > 0) {
      fd.append(
        "device_ids",
        JSON.stringify(p.device_ids.map((id) => deviceFixtureIdToRealId[id]))
      );
    }

    if (liveStreamId) {
      fd.append("live_stream_id", String(liveStreamId));
    }

    // Markdown
    if (p.description_markdown_file) {
      const md = fs.readFileSync(
        path.join(FIXTURES_DIR, p.description_markdown_file),
        "utf8"
      );
      fd.append("description_markdown", stripEmoji(md));
    }

    // Images (actual image files)
    if (p.images) {
      for (const imgPath of p.images) {
        const buf = readFile(imgPath);
        const filename = path.basename(imgPath);
        const mime = filename.endsWith(".jpg")
          ? "image/jpeg"
          : filename.endsWith(".png")
          ? "image/png"
          : "image/jpeg";
        const blob = new Blob([buf], { type: mime });
        fd.append("images", blob, filename);
      }
    }

    const created = await api("POST", "/posts", fd, creatorAuth);
    console.log(
      `  ✓ Post: "${p.title}" (${created.count} group instance(s))`
    );

    // Attachments — uploaded via /posts/:id/attachments (separate endpoint)
    if (p.attachments && p.attachments.length > 0 && created.posts?.length > 0) {
      const postId = created.posts[0].id;
      const afd = new FormData();
      for (const attPath of p.attachments) {
        const buf = readFile(attPath);
        const filename = path.basename(attPath);
        const mime = filename.endsWith(".pdf")
          ? "application/pdf"
          : "application/octet-stream";
        const blob = new Blob([buf], { type: mime });
        afd.append("attachments", blob, filename);
      }
      try {
        await api("POST", `/posts/${postId}/attachments`, afd, creatorAuth);
        console.log(`    ↳ ${p.attachments.length} attachment(s) uploaded`);
      } catch (e) {
        console.warn(`    ⚠ attachment upload skipped: ${e.message.split("\n")[0]}`);
      }
    }
  }

  console.log("🎉 Seeding complete.");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
