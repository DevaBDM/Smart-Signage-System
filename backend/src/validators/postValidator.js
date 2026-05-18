const { parseSignageState, canCreatorAssignState } = require("../utils/signageStates");
const { toBool } = require("../utils/parsers");

/**
 * Parse and validate group_ids / group_id from a request body.
 * Throws 400 if no valid groups are found.
 */
function extractGroupIds(body) {
  const raw =
    body.group_ids !== undefined
      ? typeof body.group_ids === "string"
        ? JSON.parse(body.group_ids)
        : body.group_ids
      : body.group_id !== undefined
        ? [body.group_id]
        : [];
  const ids = Array.isArray(raw)
    ? [...new Set(raw.map(Number).filter((n) => Number.isFinite(n) && n > 0))]
    : [];
  if (ids.length === 0) {
    throw Object.assign(new Error("At least one group is required"), {
      statusCode: 400,
    });
  }
  return ids;
}

/**
 * Validate signage_state against the actor's max allowed level.
 * Throws 403 if the state exceeds the actor's permission.
 */
function validateSignageState(actor, rawState) {
  const parsed = parseSignageState(rawState) || "NORMAL";
  if (actor.role === "admin") return parsed;
  if (!canCreatorAssignState(actor.max_signage_state, parsed)) {
    throw Object.assign(
      new Error(
        `You may only create signage posts up to ${actor.max_signage_state || "NORMAL"} level.`,
      ),
      { statusCode: 403 },
    );
  }
  return parsed;
}

/**
 * Build a normalized signage_metadata object from raw body fields.
 */
function buildSignageMeta(body, duration) {
  return {
    duration_seconds: duration,
    start_date: body.start_date ? new Date(body.start_date) : null,
    end_date: body.end_date ? new Date(body.end_date) : null,
    priority: Number(body.priority) || 1,
    display_group: body.display_group || null,
    is_enabled: toBool(body.is_enabled),
    play_order: Number(body.play_order) || 0,
    nocache: toBool(body.nocache),
    skip_asset_check: toBool(body.skip_asset_check),
  };
}

module.exports = { extractGroupIds, validateSignageState, buildSignageMeta };
