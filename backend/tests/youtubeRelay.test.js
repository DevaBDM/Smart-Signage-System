const { EventEmitter } = require("events");
const { resolve, startRefreshTimer } = require("../src/services/streamRelay/youtubeRelay");

// Mock child_process.spawn
jest.mock("child_process", () => ({
  spawn: jest.fn(),
}));
const { spawn } = require("child_process");

describe("youtubeRelay.resolve", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createMockChild(stdoutData, stderrData = "", exitCode = 0) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    setTimeout(() => {
      if (stdoutData) child.stdout.emit("data", stdoutData);
      if (stderrData) child.stderr.emit("data", stderrData);
      child.emit("close", exitCode);
    }, 10);
    return child;
  }

  it("resolves a YouTube URL to an HLS manifest", async () => {
    const hlsUrl = "https://manifest.example.com/live/playlist.m3u8";
    spawn.mockReturnValue(createMockChild(hlsUrl + "\n"));

    const result = await resolve("https://youtube.com/live/abc123");
    expect(result).toBe(hlsUrl);
    expect(spawn).toHaveBeenCalledWith(
      "yt-dlp",
      ["-g", "--no-warnings", "https://youtube.com/live/abc123"],
      expect.objectContaining({ timeout: 30000 })
    );
  });

  it("rejects when yt-dlp exits with non-zero code", async () => {
    spawn.mockReturnValue(createMockChild("", "ERROR: Video unavailable", 1));
    await expect(resolve("https://youtube.com/live/bad")).rejects.toThrow("yt-dlp failed");
  });

  it("rejects when yt-dlp returns a non-HLS URL", async () => {
    spawn.mockReturnValue(createMockChild("https://example.com/video.mp4\n"));
    await expect(resolve("https://youtube.com/live/bad")).rejects.toThrow("non-HLS URL");
  });

  it("rejects when yt-dlp produces no output", async () => {
    spawn.mockReturnValue(createMockChild(""));
    await expect(resolve("https://youtube.com/live/empty")).rejects.toThrow("yt-dlp failed");
  });

  it("rejects on spawn error", async () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    spawn.mockReturnValue(child);
    setTimeout(() => child.emit("error", new Error("ENOENT")), 10);
    await expect(resolve("https://youtube.com/live/err")).rejects.toThrow("spawn error");
  });
});

describe("youtubeRelay.startRefreshTimer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a handle with a working clear() method", () => {
    const handle = startRefreshTimer(42, "https://youtube.com/live/test", jest.fn());
    expect(typeof handle.clear).toBe("function");
    // Should not throw
    handle.clear();
  });
});
