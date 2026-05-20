const { spawn } = require("child_process");

const YT_DLP_PATH = process.env.YT_DLP_PATH || "yt-dlp";
const RESOLVE_TIMEOUT_MS = 30000;
const REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Resolve a YouTube Live URL to its underlying HLS manifest URL using yt-dlp.
 * @param {string} youtubeUrl
 * @returns {Promise<string>} resolved HLS manifest URL
 */
function resolve(youtubeUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(YT_DLP_PATH, ["-g", "--no-warnings", youtubeUrl], {
      timeout: RESOLVE_TIMEOUT_MS,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (err) => {
      reject(new Error(`yt-dlp spawn error: ${err.message}`));
    });

    child.on("close", (code) => {
      const url = stdout.trim().split("\n")[0];
      if (code !== 0 || !url) {
        const errDetail = stderr.trim().slice(-500) || `exit code ${code}`;
        return reject(new Error(`yt-dlp failed: ${errDetail}`));
      }
      if (!/^https?:\/\/.+\.m3u8/i.test(url)) {
        return reject(new Error(`yt-dlp returned non-HLS URL: ${url.slice(0, 200)}`));
      }
      resolve(url);
    });
  });
}

/**
 * Start a recurring refresh for an active YouTube stream.
 * @param {number} streamId
 * @param {string} sourceUrl
 * @param {Function} onResolved — callback(updatedRelayUrl)
 * @returns {{ clear: () => void }} timer handle
 */
function startRefreshTimer(streamId, sourceUrl, onResolved) {
  async function refresh() {
    try {
      const url = await resolve(sourceUrl);
      onResolved(url);
    } catch (err) {
      console.error(`[youtubeRelay] refresh failed for stream ${streamId}:`, err.message);
    }
  }

  const timer = setInterval(refresh, REFRESH_INTERVAL_MS);

  return {
    clear: () => clearInterval(timer),
  };
}

module.exports = { resolve, startRefreshTimer, REFRESH_INTERVAL_MS };
