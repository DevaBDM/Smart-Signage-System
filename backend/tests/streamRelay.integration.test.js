const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const streamRelay = require("../src/services/streamRelay");
const prisma = require("../src/db/prisma");

const TEST_VIDEO = path.resolve(__dirname, "../uploads/temp/test-stream-relay.mp4");

function findFfmpeg() {
  try {
    return require("@ffmpeg-installer/ffmpeg").path;
  } catch {
    return "ffmpeg";
  }
}

function generateTestVideo() {
  const ffmpeg = findFfmpeg();
  const result = spawnSync(ffmpeg, [
    "-f", "lavfi",
    "-i", "color=c=black:s=160x90:d=5:r=10",
    "-f", "lavfi",
    "-i", "anullsrc=r=44100:cl=mono",
    "-shortest",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-c:a", "aac",
    "-y",
    TEST_VIDEO,
  ], { timeout: 30000 });
  if (result.status !== 0) {
    const stderr = result.stderr?.toString() || "";
    if (stderr.includes("unknown encoder") || stderr.includes("not found")) {
      return false;
    }
    throw new Error(`Failed to generate test video: ${stderr.slice(0, 300)}`);
  }
  if (!fs.existsSync(TEST_VIDEO) || fs.statSync(TEST_VIDEO).size < 100) {
    return false;
  }
  return true;
}

let videoOk = false;

beforeAll(async () => {
  fs.mkdirSync(path.dirname(TEST_VIDEO), { recursive: true });
  try {
    videoOk = generateTestVideo();
  } catch (e) {
    console.warn(`[streamRelay integration] Skipping: ${e.message}`);
    videoOk = false;
  }
});

afterAll(() => {
  if (fs.existsSync(TEST_VIDEO)) {
    fs.unlinkSync(TEST_VIDEO);
  }
});

describe("streamRelay integration — real FFmpeg HLS relay", () => {
  const streamId = 9999;

  afterEach(async () => {
    await streamRelay.stop(streamId).catch(() => {});
    const dir = streamRelay.getStreamDir(streamId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("generates HLS segments from a local test video", async () => {
    if (!videoOk) return;

    const admin = await prisma.user.create({ data: { username: "stream-test-user", password_hash: "hash", role: "admin" } });
    const group = await prisma.group.create({ data: { name: "Stream Test Group" } });
    const stream = await prisma.liveStream.create({
      data: {
        id: 9999,
        title: "Integration Test Stream",
        stream_type: "HLS",
        source_url: TEST_VIDEO,
        group_id: group.id,
        created_by: admin.id,
      },
    });

    const result = await streamRelay.start(stream);

    expect(result.ok).toBe(true);
    expect(result.relay_url).toMatch(/streams\/9999\/index\.m3u8/);

    const streamDir = streamRelay.getStreamDir(9999);
    expect(fs.existsSync(streamDir)).toBe(true);

    const playlistPath = path.join(streamDir, "index.m3u8");
    expect(fs.existsSync(playlistPath)).toBe(true);

    const playlist = fs.readFileSync(playlistPath, "utf-8");
    expect(playlist).toContain("#EXTM3U");
    expect(playlist).toContain(".ts");

    const files = fs.readdirSync(streamDir);
    const segments = files.filter((f) => f.endsWith(".ts"));
    expect(segments.length).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it("stops relay and cleans up FFmpeg process", async () => {
    if (!videoOk) return;

    const admin = await prisma.user.create({ data: { username: "stop-admin", password_hash: "hash", role: "admin" } });
    const group = await prisma.group.create({ data: { name: "Stream Stop Group" } });
    const stream = await prisma.liveStream.create({
      data: {
        id: 9999,
        title: "Stop Test",
        stream_type: "HLS",
        source_url: TEST_VIDEO,
        group_id: group.id,
        created_by: admin.id,
      },
    });

    const startResult = await streamRelay.start(stream);
    expect(startResult.ok).toBe(true);

    const stopResult = await streamRelay.stop(9999);
    expect(stopResult.ok).toBe(true);

    expect(streamRelay.getStatus(9999)).toBe("stopped");
  }, 30_000);

  it("is idempotent — starting again returns already_running", async () => {
    if (!videoOk) return;

    const admin = await prisma.user.create({ data: { username: "idempotent-admin", password_hash: "hash", role: "admin" } });
    const group = await prisma.group.create({ data: { name: "Stream Idempotent Group" } });
    const stream = await prisma.liveStream.create({
      data: {
        id: 9999,
        title: "Idempotent Test",
        stream_type: "HLS",
        source_url: TEST_VIDEO,
        group_id: group.id,
        created_by: admin.id,
      },
    });

    const first = await streamRelay.start(stream);
    expect(first.ok).toBe(true);
    const second = await streamRelay.start(stream);
    expect(second.ok).toBe(true);
  }, 30_000);
});
