/** Signage urgency levels (0 = most urgent). */
const SIGNAGE_STATES = ["EMERGENCY", "SECURITY_RISK", "BREAKING_NEWS", "NORMAL"];

const STATE_RANK = {
  EMERGENCY: 0,
  SECURITY_RISK: 1,
  BREAKING_NEWS: 2,
  NORMAL: 3,
};

const STATE_LABELS = {
  EMERGENCY: "Emergency",
  SECURITY_RISK: "Security & Risk",
  BREAKING_NEWS: "Breaking News",
  NORMAL: "Normal",
};

const parseSignageState = (value) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (normalized === "SECURITY_AND_RISK") return "SECURITY_RISK";
  return SIGNAGE_STATES.includes(normalized) ? normalized : null;
};

/** States a creator may assign to a post (at or below their max urgency). */
const statesCreatorsMayAssign = (maxState) => {
  const maxRank = STATE_RANK[parseSignageState(maxState) || "NORMAL"];
  return SIGNAGE_STATES.filter((state) => STATE_RANK[state] >= maxRank);
};

/**
 * Whether a post may play while a group is in the given display mode.
 * Normal is the lowest urgency — that mode shows every level.
 * Higher modes only show posts at that level and more urgent ones.
 */
const postVisibleForGroup = (postState, groupState) => {
  const post = parseSignageState(postState) || "NORMAL";
  const group = parseSignageState(groupState) || "NORMAL";
  return STATE_RANK[post] <= STATE_RANK[group];
};

const canCreatorAssignState = (maxState, postState) =>
  statesCreatorsMayAssign(maxState).includes(parseSignageState(postState) || "NORMAL");

const rankOf = (state) => STATE_RANK[parseSignageState(state) || "NORMAL"];

const compareByUrgency = (stateA, stateB) => rankOf(stateA) - rankOf(stateB);

module.exports = {
  SIGNAGE_STATES,
  STATE_RANK,
  STATE_LABELS,
  parseSignageState,
  statesCreatorsMayAssign,
  postVisibleForGroup,
  canCreatorAssignState,
  rankOf,
  compareByUrgency,
};
