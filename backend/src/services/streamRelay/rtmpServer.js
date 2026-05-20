const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const NodeMediaServer = require("node-media-server");
const liveStreamRepo = require("../../repositories/liveStreamRepo");

const RTMP_PORT = Number(process.env.RTMP_PORT) || 1935;
const RTMP_HTTP_PORT = Number(process.env.RTMP_HTTP_PORT) || 8000;
const STREAMS_DIR = process.env.STREAMS_DIR || path.resolve(__dirname, "../../../streams");

const RELAY_PROCESSES = new Map(); // streamId -> child
let nms = null;

function getRelayUrl(streamId) {
  return `${process.env.PUBLIC_BASE_URL || ""}/streams/${streamId}/index.m3u8`;
}

function ensureStreamDir(id) {
  const dir = path.join(STREAMS_DIR, String(id));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function startFfmpegRelay(streamId, streamKey) {
  const dir = ensureStreamDir(streamId);
  const outputPath = path.join(dir, "index.m3u8");
  const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

  const args = [
    "-i", `rtmp://localhost:${RTMP_PORT}/live/${streamKey}`,
    "-c", "copy",
    "-f", "hls",
    "-hls_time", "2",
    "-hls_list_size", "10",
    "-hls_flags", "delete_segments",
    outputPath,
  ];

  const child = spawn(ffmpegPath, args, { detached: false });

  child.stderr.on("data", (data) => {
    // ffmpeg logs to stderr; keep quiet unless debugging
  });

  child.on("exit", async (code) => {
    RELAY_PROCESSES.delete(streamId);
    if (code !== 0 && code !== null) {
      await liveStreamRepo.update(streamId, {
        status: "error",
        last_error: `ffmpeg exited with code ${code}`,
      });
    }
  });

  RELAY_PROCESSES.set(streamId, child);
  console.log(`[rtmpServer] Started ffmpeg relay for stream ${streamId}`);
}

function stopFfmpegRelay(streamId) {
  const child = RELAY_PROCESSES.get(streamId);
  if (!child) return;
  child.kill("SIGTERM");
  setTimeout(() => {
    if (!child.killed) child.kill("SIGKILL");
  }, 5000);
  RELAY_PROCESSES.delete(streamId);
  console.log(`[rtmpServer] Stopped ffmpeg relay for stream ${streamId}`);
}

function init() {
  if (nms) return;

  const config = {
    rtmp: {
      port: RTMP_PORT,
      chunk_size: 60000,
      gop_cache: true,
      ping: 30,
      ping_timeout: 60,
    },
    http: {
      port: RTMP_HTTP_PORT,
      allow_origin: "*",
    },
  };

  nms = new NodeMediaServer(config);

  nms.on("prePublish", async function (id, streamPath, args) {
    const streamKey = streamPath.split("/").pop();
    const prisma = require("../../db/prisma");
    const stream = await prisma.liveStream.findUnique({
      where: { stream_key: streamKey },
    });

    if (!stream) {
      console.error(`[rtmpServer] Rejected publish: unknown stream_key ${streamKey}`);
      this.reject();
      return;
    }

    console.log(`[rtmpServer] Accepted publish for stream ${stream.id} key ${streamKey}`);
    startFfmpegRelay(stream.id, streamKey);
    await liveStreamRepo.update(stream.id, { status: "online" });
  });

  nms.on("donePublish", async function (id, streamPath, args) {
    const streamKey = streamPath.split("/").pop();
    const prisma = require("../../db/prisma");
    const stream = await prisma.liveStream.findUnique({
      where: { stream_key: streamKey },
    });

    if (stream) {
      stopFfmpegRelay(stream.id);
      await liveStreamRepo.update(stream.id, { status: "idle" });
    }
  });

  nms.run();
  console.log(`[rtmpServer] RTMP server running on port ${RTMP_PORT}`);
}

function stop() {
  if (nms) {
    nms.stop();
    nms = null;
  }
  for (const [streamId, child] of RELAY_PROCESSES) {
    child.kill("SIGTERM");
    RELAY_PROCESSES.delete(streamId);
  }
}

module.exports = {
  init,
  stop,
  startFfmpegRelay,
  stopFfmpegRelay,
  getRelayUrl,
  RTMP_PORT,
  RTMP_HTTP_PORT,
};
