/** Parse media_crops from multipart body (JSON string or array). */
function parseMediaCrops(body, fileCount) {
  if (!fileCount) return [];
  let raw = body?.media_crops;
  if (raw === undefined || raw === null || raw === "") {
    return Array.from({ length: fileCount }, () => null);
  }
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) {
      return Array.from({ length: fileCount }, () => parsed);
    }
    return Array.from({ length: fileCount }, (_, i) => parsed[i] ?? null);
  } catch {
    return Array.from({ length: fileCount }, () => null);
  }
}

module.exports = { parseMediaCrops };
