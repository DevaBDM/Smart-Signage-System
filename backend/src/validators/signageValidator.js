const {
  parseSignageState,
  canCreatorAssignState,
} = require("../utils/signageStates");

/**
 * Validate that a user can publish a post with the given signage state.
 * If body.signage_state is provided, it validates and returns the parsed state.
 * Otherwise validates the existing post.signage_state.
 *
 * @param {object} actor – user with role and max_signage_state
 * @param {object} post – post object with signage_state
 * @param {object} body – request body (may contain signage_state override)
 * @returns {string} validated signage state
 * @throws {Error} with statusCode 400 or 403 on failure
 */
function validateSignageStateForPublish(actor, post, body) {
  if (body.signage_state !== undefined) {
    const parsed = parseSignageState(body.signage_state);
    if (!parsed) {
      throw Object.assign(new Error("Invalid signage_state"), {
        statusCode: 400,
      });
    }
    if (
      actor.role !== "admin" &&
      !canCreatorAssignState(actor.max_signage_state, parsed)
    ) {
      throw Object.assign(
        new Error(
          `You may only publish signage posts up to ${actor.max_signage_state || "NORMAL"} level.`,
        ),
        { statusCode: 403 },
      );
    }
    return parsed;
  }

  if (
    actor.role !== "admin" &&
    !canCreatorAssignState(actor.max_signage_state, post.signage_state)
  ) {
    throw Object.assign(
      new Error(
        `This post's signage level exceeds your allowed maximum (${actor.max_signage_state || "NORMAL"}).`,
      ),
      { statusCode: 403 },
    );
  }
  return post.signage_state;
}

module.exports = { validateSignageStateForPublish };
