const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const liveStreamRepo = require("../../repositories/liveStreamRepo");
const youtubeRelay = require("./youtubeRelay");
const rtmpServer = require("./rtmpServer");

const STREAMS_DIR = process.env.STREAMS_DIR || path.resolve(__dirname, "../../../streams");
const PROCESSES = new Map(); // id -> { child, type, startedAt, refreshTimer, sourceUrl }

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

function buildRelayUrl(id) {
  return `${process.env.PUBLIC_BASE_URL || ""}/streams/${id}/index.m3u8`;
}

/** Start an FFmpeg HLS relay for any input URL. */
function startFfmpegHlsRelay(id, inputUrl, extraInputArgs = []) {
  return new Promise((resolve) => {
    const dir = ensureStreamDir(id);
    const outputPath = path.join(dir, "index.m3u8");
    const relayUrl = buildRelayUrl(id);

    const args = [
      ...extraInputArgs,
      "-i", inputUrl,
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

    PROCESSES.set(id, { child, type: "HLS_RELAY", startedAt: Date.now(), sourceUrl: inputUrl });

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

/** Stop and restart FFmpeg with a new input URL. */
async function restartFfmpegHlsRelay(id, newInputUrl, extraInputArgs = []) {
  const proc = PROCESSES.get(id);
  if (proc?.child) {
    proc.child.kill("SIGTERM");
    setTimeout(() => {
      if (!proc.child.killed) proc.child.kill("SIGKILL");
    }, 5000);
  }
  if (proc?.refreshTimer) {
    proc.refreshTimer.clear();
  }
  PROCESSES.delete(id);
  // Small delay to let old process release files
  await new Promise((r) => setTimeout(r, 500));
  return startFfmpegHlsRelay(id, newInputUrl, extraInputArgs);
}

/** Start relay for a stream. Idempotent. */
async function start(stream) {
  const id = stream.id;
  if (PROCESSES.has(id)) {
    return { ok: true, status: "already_running", relay_url: stream.relay_url };
  }

  if (stream.stream_type === "HLS") {
    // Proxy external HLS through local FFmpeg so isolated Pi devices can reach it
    return startFfmpegHlsRelay(id, stream.source_url);
  }

  if (stream.stream_type === "RTSP") {
    return startFfmpegHlsRelay(id, stream.source_url, ["-rtsp_transport", "tcp"]);
  }

  if (stream.stream_type === "YOUTUBE") {
    const resolvedUrl = await youtubeRelay.resolve(stream.source_url);
    const result = await startFfmpegHlsRelay(id, resolvedUrl);

    // Refresh timer: re-resolve YouTube URL and restart FFmpeg periodically
    const refreshTimer = youtubeRelay.startRefreshTimer(
      id,
      stream.source_url,
      async (url) => {
        await restartFfmpegHlsRelay(id, url);
      }
    );

    const proc = PROCESSES.get(id);
    if (proc) {
      proc.refreshTimer = refreshTimer;
    }

    return result;
  }

  if (stream.stream_type === "RTMP") {
    const relayUrl = rtmpServer.getRelayUrl(stream.id);
    await liveStreamRepo.update(id, { relay_url: relayUrl, status: "starting" });
    PROCESSES.set(id, { type: "RTMP", passthrough: false, startedAt: Date.now() });
    return { ok: true, status: "started", relay_url: relayUrl };
  }

  return { ok: false, error: `Unsupported stream_type: ${stream.stream_type}` };
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
    setTimeout(() => {
      if (!proc.child.killed) proc.child.kill("SIGKILL");
    }, 5000);
  }

  if (proc.type === "RTMP") {
    rtmpServer.stopFfmpegRelay(id);
  }

  PROCESSES.delete(id);
  await liveStreamRepo.update(id, { status: "offline" });
  return { ok: true, status: "stopped" };
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
