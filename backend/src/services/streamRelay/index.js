const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const liveStreamRepo = require("../../repositories/liveStreamRepo");
const youtubeRelay = require("./youtubeRelay");
const rtmpServer = require("./rtmpServer");
const logBuffer = require("./logBuffer");

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
  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${base}/streams/${id}/index.m3u8`;
}

/** Start an FFmpeg HLS relay for any input URL. */
function startFfmpegHlsRelay(id, inputUrl, extraInputArgs = []) {
  return new Promise((resolve) => {
    const dir = ensureStreamDir(id);
    const outputPath = path.join(dir, "index.m3u8");
    const relayUrl = buildRelayUrl(id);

    const isRtsp = inputUrl.startsWith("rtsp://");

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

    logBuffer.append(id, `ffmpeg args: ${args.join(" ")}`);
    logBuffer.append(id, `ffmpeg start pid=${child.pid}`);

    let stderrBuffer = "";
    let hasExited = false;
    let exitCode = null;

    child.stderr.on("data", (data) => {
      const text = data.toString();
      stderrBuffer += text;
      if (stderrBuffer.length > 4096) {
        stderrBuffer = stderrBuffer.slice(-4096);
      }
      text.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed) logBuffer.append(id, `ffmpeg: ${trimmed}`);
      });
    });

    child.stdout.on("data", (data) => {
      data.toString().split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (trimmed) logBuffer.append(id, `ffmpeg stdout: ${trimmed}`);
      });
    });

    child.on("exit", async (code) => {
      hasExited = true;
      exitCode = code;
      PROCESSES.delete(id);
      logBuffer.append(id, `ffmpeg exit code=${code}`);
      if (code !== 0 && code !== null) {
        const lastErr = stderrBuffer.slice(-500) || `ffmpeg exited with code ${code}`;
        logBuffer.append(id, `ffmpeg error: ${lastErr}`);
        await liveStreamRepo.update(id, {
          status: "error",
          last_error: lastErr,
        });
      }
    });

    PROCESSES.set(id, { child, type: "HLS_RELAY", startedAt: Date.now(), sourceUrl: inputUrl });

    // RTSP negotiation can take 5-10 seconds; use longer timeout
    const startupMs = isRtsp ? 10_000 : 3_000;
    setTimeout(async () => {
      if (fs.existsSync(outputPath)) {
        await liveStreamRepo.update(id, { relay_url: relayUrl, status: "online" });
        resolve({ ok: true, status: "started", relay_url: relayUrl });
        return;
      }

      if (hasExited && exitCode !== 0) {
        const lastErr = stderrBuffer.slice(-500) || `ffmpeg exited with code ${exitCode}`;
        logBuffer.append(id, `startup failed: ffmpeg exited early — ${lastErr}`);
        resolve({ ok: false, error: lastErr });
        return;
      }

      // Still running but no output yet — for RTSP give it more time
      if (isRtsp && !hasExited) {
        logBuffer.append(id, "startup: no playlist yet, FFmpeg still connecting (RTSP can be slow)...");
      }

      resolve({ ok: false, error: `ffmpeg did not produce output within ${startupMs}ms startup window` });
    }, startupMs);
  });
}

/** Stop and restart FFmpeg with a new input URL. */
async function restartFfmpegHlsRelay(id, newInputUrl, extraInputArgs = []) {
  logBuffer.append(id, `ffmpeg restart requested input=${newInputUrl}`);
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
  logBuffer.clear(id);
  logBuffer.append(id, `relay start requested type=${stream.stream_type} source=${stream.source_url || "(none)"}`);
  if (PROCESSES.has(id)) {
    logBuffer.append(id, "relay already running");
    return { ok: true, status: "already_running", relay_url: stream.relay_url };
  }

  if (stream.stream_type === "HLS") {
    logBuffer.append(id, `starting HLS relay from ${stream.source_url}`);
    return startFfmpegHlsRelay(id, stream.source_url);
  }

  if (stream.stream_type === "RTSP") {
    logBuffer.append(id, `starting RTSP relay from ${stream.source_url}`);
    // -rtsp_transport tcp forces TCP instead of UDP (more reliable through NAT/firewalls)
    // -stimeout in microseconds (5s socket timeout for TCP connect)
    return startFfmpegHlsRelay(id, stream.source_url, [
      "-rtsp_transport", "tcp",
      "-stimeout", "5000000",
    ]);
  }

  if (stream.stream_type === "YOUTUBE") {
    logBuffer.append(id, `resolving YouTube URL: ${stream.source_url}`);
    const resolvedUrl = await youtubeRelay.resolve(stream.source_url);
    logBuffer.append(id, `resolved YouTube URL: ${resolvedUrl}`);
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
    logBuffer.append(id, `starting RTMP relay; awaiting ingest on ${relayUrl}`);
    await liveStreamRepo.update(id, { relay_url: relayUrl, status: "starting" });
    PROCESSES.set(id, { type: "RTMP", passthrough: false, startedAt: Date.now() });
    return { ok: true, status: "started", relay_url: relayUrl };
  }

  logBuffer.append(id, `Unsupported stream_type: ${stream.stream_type}`);
  return { ok: false, error: `Unsupported stream_type: ${stream.stream_type}` };
}

/** Stop relay for a stream. Idempotent. */
async function stop(id) {
  const proc = PROCESSES.get(id);
  if (!proc) {
    return { ok: true, status: "already_stopped" };
  }

  logBuffer.append(id, "relay stop requested");

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
  logBuffer.append(id, "relay stopped");
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

function getLogs(id, limit) {
  return logBuffer.get(id, limit);
}

module.exports = {
  start,
  stop,
  getStatus,
  getLogs,
  bootstrapAll,
  pruneOrphanDirs,
  getStreamDir,
  PROCESSES,
};
