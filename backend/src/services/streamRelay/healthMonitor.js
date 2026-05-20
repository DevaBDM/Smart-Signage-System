const { spawn } = require("child_process");
const liveStreamRepo = require("../../repositories/liveStreamRepo");
const { PROCESSES, getStreamDir } = require("./index");

const INTERVAL_MS = 30_000;

function ffprobeStream(playlistPath) {
  return new Promise((resolve) => {
    const ffprobePath = require("@ffprobe-installer/ffprobe").path;
    const child = spawn(
      ffprobePath,
      [
        "-v", "error",
        "-show_entries", "format=duration,bit_rate",
        "-show_entries", "stream=codec_name,r_frame_rate",
        "-of", "json",
        playlistPath,
      ],
      { timeout: 10_000 }
    );

    let stdout = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.on("close", (code) => {
      if (code !== 0) return resolve(null);
      try {
        const info = JSON.parse(stdout);
        resolve(info);
      } catch {
        resolve(null);
      }
    });
    child.on("error", () => resolve(null));
  });
}

async function checkStream(id) {
  const proc = PROCESSES.get(id);
  if (!proc) {
    await liveStreamRepo.update(id, { status: "offline", last_seen: new Date() });
    return;
  }

  if (proc.type === "HLS" && proc.passthrough) {
    // Passthrough streams stay online as long as process record exists
    await liveStreamRepo.update(id, { status: "online", last_seen: new Date() });
    return;
  }

  const playlistPath = `${getStreamDir(id)}/index.m3u8`;
  const info = await ffprobeStream(playlistPath);

  if (!info) {
    await liveStreamRepo.update(id, { status: "error", last_seen: new Date(), last_error: "ffprobe failed" });
    return;
  }

  const streamInfo = info.streams?.[0];
  const formatInfo = info.format;
  await liveStreamRepo.update(id, {
    status: "online",
    last_seen: new Date(),
    last_error: null,
  });
}

function start() {
  setInterval(async () => {
    const ids = Array.from(PROCESSES.keys());
    for (const id of ids) {
      try {
        await checkStream(id);
      } catch (err) {
        console.error(`[healthMonitor] check failed for stream ${id}:`, err.message);
      }
    }
  }, INTERVAL_MS);
}

module.exports = { start, checkStream };
