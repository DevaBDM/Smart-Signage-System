const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const liveStreamRepo = require("../../repositories/liveStreamRepo");
const youtubeRelay = require("./youtubeRelay");

const STREAMS_DIR = process.env.STREAMS_DIR || path.resolve(__dirname, "../../../streams");
const PROCESSES = new Map(); // id -> { child, type, startedAt }

function getStreamDir(id) {
  return path.join(STREAMS_DIR, String(id));
}

function ensureStreamDir(id) {
  const dir = getStreamDir(id);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getStatus(id) {
  return PROCESSES.has(id) ? "running" : "stopped";
}

/** Start relay for a stream. Idempotent. */
async function start(stream) {
  const id = stream.id;
  if (PROCESSES.has(id)) {
    return { ok: true, status: "already_running", relay_url: stream.relay_url };
  }

  if (stream.stream_type === "HLS") {
    // Passthrough: no local relay needed
    const relayUrl = stream.source_url;
    await liveStreamRepo.update(id, { relay_url: relayUrl, status: "online" });
    PROCESSES.set(id, { type: "HLS", passthrough: true, startedAt: Date.now() });
    return { ok: true, status: "started", relay_url: relayUrl };
  }

  if (stream.stream_type === "RTSP") {
    return startRtspRelay(stream);
  }

  if (stream.stream_type === "YOUTUBE") {
    return startYouTubeRelay(stream);
  }

  if (stream.stream_type === "RTMP") {
    // RTMP ingest handled by node-media-server — placeholder for Phase 5
    return { ok: false, error: "RTMP relay not yet implemented" };
  }

  return { ok: false, error: `Unsupported stream_type: ${stream.stream_type}` };
}

/** Start a YouTube relay by resolving the URL via yt-dlp and treating it as HLS passthrough. */
async function startYouTubeRelay(stream) {
  const id = stream.id;
  const resolvedUrl = await youtubeRelay.resolve(stream.source_url);
  await liveStreamRepo.update(id, { relay_url: resolvedUrl, status: "online" });

  const refreshTimer = youtubeRelay.startRefreshTimer(
    id,
    stream.source_url,
    async (url) => {
      await liveStreamRepo.update(id, { relay_url: url });
    }
  );

  PROCESSES.set(id, {
    type: "YOUTUBE",
    passthrough: true,
    refreshTimer,
    startedAt: Date.now(),
  });

  return { ok: true, status: "started", relay_url: resolvedUrl };
}

/** Stop relay for a stream. Idempotent. */
async function stop(id) {
  const proc = PROCESSES.get(id);
  if (!proc) {
    return { ok: true, status: "already_stopped" };
  }

  if (proc.refreshTimer) {
    proc.refreshTimer.clear();
  }

  if (proc.child) {
    proc.child.kill("SIGTERM");
    // Force kill after 5s if still alive
    setTimeout(() => {
      if (!proc.child.killed) proc.child.kill("SIGKILL");
    }, 5000);
  }

  PROCESSES.delete(id);
  await liveStreamRepo.update(id, { status: "offline" });
  return { ok: true, status: "stopped" };
}

function startRtspRelay(stream) {
  return new Promise((resolve) => {
    const id = stream.id;
    const dir = ensureStreamDir(id);
    const outputPath = path.join(dir, "index.m3u8");
    const relayUrl = `${process.env.PUBLIC_BASE_URL || ""}/streams/${id}/index.m3u8`;

    const args = [
      "-rtsp_transport", "tcp",
      "-i", stream.source_url,
      "-c", "copy",
      "-f", "hls",
      "-hls_time", "2",
      "-hls_list_size", "10",
      "-hls_flags", "delete_segments",
      outputPath,
    ];

    const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
    const child = spawn(ffmpegPath, args, { detached: false });

    let stderrBuffer = "";
    child.stderr.on("data", (data) => {
      stderrBuffer += data.toString();
      // Keep last 4KB of stderr for error reporting
      if (stderrBuffer.length > 4096) {
        stderrBuffer = stderrBuffer.slice(-4096);
      }
    });

    child.on("exit", async (code) => {
      PROCESSES.delete(id);
      if (code !== 0 && code !== null) {
        await liveStreamRepo.update(id, {
          status: "error",
          last_error: stderrBuffer.slice(-500) || `ffmpeg exited with code ${code}`,
        });
      }
    });

    PROCESSES.set(id, { child, type: "RTSP", startedAt: Date.now() });

    // Give ffmpeg a moment to start writing the playlist
    setTimeout(async () => {
      if (fs.existsSync(outputPath)) {
        await liveStreamRepo.update(id, { relay_url: relayUrl, status: "online" });
        resolve({ ok: true, status: "started", relay_url: relayUrl });
      } else {
        resolve({ ok: false, error: "ffmpeg did not produce output within startup window" });
      }
    }, 3000);
  });
}

/** Restart relays for all streams that have published signage posts. */
async function bootstrapAll() {
  const publishedStreams = await require("../../db/prisma").liveStream.findMany({
    where: {
      posts: {
        some: {
          status: "published",
          allowed_on_signage: true,
        },
      },
    },
  });

  for (let i = 0; i < publishedStreams.length; i++) {
    const stream = publishedStreams[i];
    // Throttle to avoid stampeding ffmpeg on boot
    await new Promise((r) => setTimeout(r, i * 500));
    try {
      await start(stream);
    } catch (err) {
      console.error(`[streamRelay] bootstrap failed for stream ${stream.id}:`, err.message);
    }
  }
}

/** Prune orphan stream directories that have no matching DB row. */
function pruneOrphanDirs() {
  if (!fs.existsSync(STREAMS_DIR)) return;
  const dirs = fs.readdirSync(STREAMS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => Number(d.name))
    .filter((id) => !Number.isNaN(id));

  if (dirs.length === 0) return;

  require("../../db/prisma").liveStream.findMany({
    where: { id: { in: dirs } },
    select: { id: true },
  }).then((existing) => {
    const existingIds = new Set(existing.map((e) => e.id));
    for (const id of dirs) {
      if (!existingIds.has(id)) {
        const dir = getStreamDir(id);
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`[streamRelay] pruned orphan stream dir: ${dir}`);
      }
    }
  });
}

module.exports = {
  start,
  stop,
  getStatus,
  bootstrapAll,
  pruneOrphanDirs,
  getStreamDir,
  PROCESSES,
};
