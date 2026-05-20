const { EventEmitter } = require("events");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

jest.mock("child_process", () => ({
  spawn: jest.fn(),
}));

jest.mock("@ffmpeg-installer/ffmpeg", () => ({ path: "/mock/ffmpeg" }));
jest.mock("@ffprobe-installer/ffprobe", () => ({ path: "/mock/ffprobe" }));

// Mock fs to avoid actual disk writes
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(),
  rmSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

// Mock prisma for bootstrapAll / pruneOrphanDirs / liveStreamRepo
jest.mock("../src/db/prisma", () => ({
  liveStream: {
    findMany: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({}),
  },
}));

const prisma = require("../src/db/prisma");
const streamRelay = require("../src/services/streamRelay");
const liveStreamRepo = require("../src/repositories/liveStreamRepo");

function createMockChild() {
  const child = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = jest.fn(() => { child.killed = true; });
  child.killed = false;
  return child;
}

describe("streamRelay.start", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    streamRelay.PROCESSES.clear();
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockReturnValue(undefined);
  });

  it("starts HLS passthrough and sets relay_url", async () => {
    const stream = { id: 1, stream_type: "HLS", source_url: "https://example.com/stream.m3u8" };
    const result = await streamRelay.start(stream);

    expect(result.ok).toBe(true);
    expect(result.status).toBe("started");
    expect(result.relay_url).toBe("https://example.com/stream.m3u8");
    expect(streamRelay.getStatus(1)).toBe("running");
  });

  it("is idempotent for already-running streams", async () => {
    const stream = { id: 2, stream_type: "HLS", source_url: "https://example.com/stream.m3u8" };
    await streamRelay.start(stream);
    const result = await streamRelay.start(stream);

    expect(result.ok).toBe(true);
    expect(result.status).toBe("already_running");
  });

  it("spawns ffmpeg for RTSP and resolves after playlist exists", async () => {
    const child = createMockChild();
    spawn.mockReturnValue(child);

    // First call (existsSync inside ensureStreamDir) returns false,
    // second call (startup check) returns true
    fs.existsSync
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    const stream = { id: 3, stream_type: "RTSP", source_url: "rtsp://192.168.1.10/stream" };
    const promise = streamRelay.start(stream);

    // Allow spawn events to register before timeout
    await new Promise((r) => setTimeout(r, 100));
    const result = await promise;

    expect(spawn).toHaveBeenCalledWith(
      "/mock/ffmpeg",
      expect.arrayContaining(["-rtsp_transport", "tcp", "-i", "rtsp://192.168.1.10/stream"]),
      expect.any(Object)
    );
    expect(result.ok).toBe(true);
    expect(result.relay_url).toMatch(/streams\/3\/index\.m3u8/);
    expect(streamRelay.getStatus(3)).toBe("running");

    // Simulate ffmpeg exit to avoid leaving process handlers
    child.emit("exit", 0);
  });
});

describe("streamRelay.stop", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    streamRelay.PROCESSES.clear();
  });

  it("stops a running HLS passthrough", async () => {
    const stream = { id: 4, stream_type: "HLS", source_url: "https://example.com/stream.m3u8" };
    await streamRelay.start(stream);
    const result = await streamRelay.stop(4);

    expect(result.ok).toBe(true);
    expect(result.status).toBe("stopped");
    expect(streamRelay.getStatus(4)).toBe("stopped");
  });

  it("is idempotent for already-stopped streams", async () => {
    const result = await streamRelay.stop(999);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("already_stopped");
  });

  it("kills ffmpeg child for RTSP streams", async () => {
    const child = createMockChild();
    spawn.mockReturnValue(child);
    fs.existsSync
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    const stream = { id: 5, stream_type: "RTSP", source_url: "rtsp://192.168.1.10/stream" };
    await streamRelay.start(stream);
    await new Promise((r) => setTimeout(r, 100));

    expect(streamRelay.getStatus(5)).toBe("running");

    const result = await streamRelay.stop(5);
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(result.ok).toBe(true);
    expect(result.status).toBe("stopped");
  });
});

describe("streamRelay.bootstrapAll", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    streamRelay.PROCESSES.clear();
  });

  it("starts relays for all published live streams", async () => {
    prisma.liveStream.findMany.mockResolvedValue([
      { id: 10, stream_type: "HLS", source_url: "https://example.com/a.m3u8" },
      { id: 11, stream_type: "HLS", source_url: "https://example.com/b.m3u8" },
    ]);

    await streamRelay.bootstrapAll();

    expect(streamRelay.getStatus(10)).toBe("running");
    expect(streamRelay.getStatus(11)).toBe("running");
  });
});

describe("streamRelay.pruneOrphanDirs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("removes stream directories with no matching DB row", async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readdirSync.mockReturnValue([
      { name: "100", isDirectory: () => true },
      { name: "200", isDirectory: () => true },
      { name: "not-a-dir.txt", isDirectory: () => false },
    ]);

    prisma.liveStream.findMany.mockResolvedValue([{ id: 100 }]);

    streamRelay.pruneOrphanDirs();

    // Allow the promise-based prune to finish
    await new Promise((r) => setTimeout(r, 50));

    expect(fs.rmSync).toHaveBeenCalledWith(
      expect.stringContaining("200"),
      expect.objectContaining({ recursive: true, force: true })
    );
    expect(fs.rmSync).not.toHaveBeenCalledWith(
      expect.stringContaining("100"),
      expect.anything()
    );
  });
});
