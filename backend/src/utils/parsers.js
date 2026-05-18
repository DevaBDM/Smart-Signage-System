const toBool = (val) => val === true || val === "true";

const parseIdList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(Number).filter(Boolean);
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) return parsed.map(Number).filter(Boolean);
  } catch {
    /* ignore parse errors */
  }
  return String(value).split(",").map(Number).filter(Boolean);
};

const parseDeviceIds = parseIdList;
const parseGroupIds = parseIdList;

module.exports = { toBool, parseDeviceIds, parseGroupIds };
