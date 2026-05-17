const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const ffprobeInstaller = require("@ffprobe-installer/ffprobe");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const UPLOAD_ROOT = path.join(__dirname, "../../uploads");
const IMAGE_DIR = path.join(UPLOAD_ROOT, "images");
const VIDEO_DIR = path.join(UPLOAD_ROOT, "videos");
const TEMP_DIR = path.join(UPLOAD_ROOT, "temp");

for (const dir of [IMAGE_DIR, VIDEO_DIR, TEMP_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const randomName = (ext) =>
  `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;

const clamp01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));

const normalizeImageCrop = (crop) => ({
  x: clamp01(crop?.x),
  y: clamp01(crop?.y),
  width: Math.min(1, Math.max(0.01, Number(crop?.width) || 1)),
  height: Math.min(1, Math.max(0.01, Number(crop?.height) || 1)),
});

const normalizeVideoCrop = (crop, videoDuration) => {
  const duration = Math.max(0, Number(videoDuration) || 0);
  let start = Math.max(0, Number(crop?.start) || 0);
  let end = crop?.end !== undefined && crop?.end !== null ? Number(crop.end) : duration;
  if (!Number.isFinite(end) || end <= 0) end = duration;
  if (end <= start) end = Math.min(duration, start + 1);
  end = Math.min(duration || end, end);

  return {
    start,
    end,
    x: clamp01(crop?.x),
    y: clamp01(crop?.y),
    width: Math.min(1, Math.max(0.01, Number(crop?.width) || 1)),
    height: Math.min(1, Math.max(0.01, Number(crop?.height) || 1)),
  };
};

const probeVideo = (filePath) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => (err ? reject(err) : resolve(data)));
  });

const isVideoMime = (mime) => typeof mime === "string" && mime.startsWith("video/");
const isImageMime = (mime) => typeof mime === "string" && mime.startsWith("image/");

async function processImage(inputPath, crop) {
  const meta = await sharp(inputPath).metadata();
  const w = meta.width || 1;
  const h = meta.height || 1;
  const c = normalizeImageCrop(crop);

  let left = Math.round(c.x * w);
  let top = Math.round(c.y * h);
  let width = Math.round(c.width * w);
  let height = Math.round(c.height * h);
  left = Math.min(left, w - 1);
  top = Math.min(top, h - 1);
  width = Math.min(width, w - left);
  height = Math.min(height, h - top);

  const filename = randomName(".webp");
  const outputPath = path.join(IMAGE_DIR, filename);

  await sharp(inputPath)
    .extract({ left, top, width, height })
    .rotate()
    .webp({ quality: 88 })
    .toFile(outputPath);

  const publicPath = `/uploads/images/${filename}`;
  assertMediaFileExists(publicPath);
  return {
    image_path: publicPath,
    media_type: "IMAGE",
    duration_seconds: null,
  };
}

async function processVideo(inputPath, crop) {
  const probe = await probeVideo(inputPath);
  const videoStream = probe.streams?.find((s) => s.codec_type === "video");
  const fullDuration = Number(probe.format?.duration) || 0;
  const vw = videoStream?.width || 1920;
  const vh = videoStream?.height || 1080;
  const c = normalizeVideoCrop(crop, fullDuration);
  const clipDuration = Math.max(0.5, c.end - c.start);

  const filename = randomName(".mp4");
  const outputPath = path.join(VIDEO_DIR, filename);

  const cropW = Math.round(c.width * vw);
  const cropH = Math.round(c.height * vh);
  const cropX = Math.round(c.x * vw);
  const cropY = Math.round(c.y * vh);
  const spatialCrop =
    c.width < 0.999 || c.height < 0.999 || c.x > 0.001 || c.y > 0.001;

  await new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputPath)
      .setStartTime(c.start)
      .setDuration(clipDuration)
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        "-c:a aac",
        "-b:a 128k",
        "-movflags +faststart",
        "-pix_fmt yuv420p",
      ]);

    if (spatialCrop) {
      cmd = cmd.videoFilters(`crop=${cropW}:${cropH}:${cropX}:${cropY}`);
    }

    cmd.on("end", () => {
      if (!fs.existsSync(outputPath)) {
        reject(new Error("Video export failed: output file was not created"));
        return;
      }
      resolve();
    }).on("error", reject).save(outputPath);
  });

  const publicPath = `/uploads/videos/${filename}`;
  assertMediaFileExists(publicPath);
  return {
    image_path: publicPath,
    media_type: "VIDEO",
    duration_seconds: Math.ceil(clipDuration),
  };
}

/**
 * Process one uploaded temp file (image or video) with optional crop spec.
 * Deletes the source temp file when done.
 */
async function processMediaFile(file, crop) {
  const inputPath = file.path;
  const mime = file.mimetype || "";

  try {
    if (isVideoMime(mime)) {
      return await processVideo(inputPath, crop);
    }
    if (isImageMime(mime)) {
      return await processImage(inputPath, crop);
    }
    throw new Error(`Unsupported media type: ${mime || file.originalname}`);
  } finally {
    if (fs.existsSync(inputPath)) {
      try {
        fs.unlinkSync(inputPath);
      } catch {
        /* ignore temp cleanup errors */
      }
    }
  }
}

async function processMediaFiles(files, crops = []) {
  const results = [];
  for (let i = 0; i < files.length; i += 1) {
    results.push(await processMediaFile(files[i], crops[i]));
  }
  return results;
}

function deleteMediaFile(publicPath) {
  const fullPath = resolvePublicPath(publicPath);
  if (fullPath && fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

const UPLOAD_ROOT_RESOLVED = path.resolve(UPLOAD_ROOT);

/** Map public URL (/uploads/...) to absolute disk path (Windows-safe). */
function resolvePublicPath(publicPath) {
  if (!publicPath || typeof publicPath !== "string") return null;
  const rel = publicPath.replace(/^\/uploads\/?/, "").replace(/\\/g, "/");
  const segments = rel.split("/").filter(Boolean);
  if (segments.some((s) => s === "." || s === "..")) return null;
  const abs = path.resolve(UPLOAD_ROOT_RESOLVED, ...segments);
  if (
    abs !== UPLOAD_ROOT_RESOLVED &&
    !abs.startsWith(`${UPLOAD_ROOT_RESOLVED}${path.sep}`)
  ) {
    return null;
  }
  return abs;
}

function mediaFileExists(publicPath) {
  const abs = resolvePublicPath(publicPath);
  return Boolean(abs && fs.existsSync(abs));
}

function assertMediaFileExists(publicPath) {
  const abs = resolvePublicPath(publicPath);
  if (!abs || !fs.existsSync(abs)) {
    throw new Error(`Media file not found on server: ${publicPath}`);
  }
  return abs;
}

module.exports = {
  UPLOAD_ROOT,
  IMAGE_DIR,
  VIDEO_DIR,
  TEMP_DIR,
  isVideoMime,
  isImageMime,
  processMediaFile,
  processMediaFiles,
  deleteMediaFile,
  probeVideo,
  resolvePublicPath,
  mediaFileExists,
  assertMediaFileExists,
};
