export const SIGNAGE_STATES = [
  "EMERGENCY",
  "SECURITY_RISK",
  "BREAKING_NEWS",
  "NORMAL",
];

export const SIGNAGE_STATE_LABELS = {
  EMERGENCY: "Emergency",
  SECURITY_RISK: "Security & Risk",
  BREAKING_NEWS: "Breaking News",
  NORMAL: "Normal",
};

const STATE_RANK = {
  EMERGENCY: 0,
  SECURITY_RISK: 1,
  BREAKING_NEWS: 2,
  NORMAL: 3,
};

/** Options a creator may pick when creating/editing signage posts. */
export function creatorSignageStateOptions(maxState = "NORMAL") {
  const maxRank = STATE_RANK[maxState] ?? STATE_RANK.NORMAL;
  return SIGNAGE_STATES.filter((state) => STATE_RANK[state] >= maxRank).map(
    (value) => ({
      value,
      label: SIGNAGE_STATE_LABELS[value],
    }),
  );
}

/** Human-readable summary of what plays in a given group display mode. */
export function groupStateVisibilityHint(groupState) {
  switch (groupState) {
    case "EMERGENCY":
      return "Only Emergency posts play.";
    case "SECURITY_RISK":
      return "Emergency and Security & Risk posts play.";
    case "BREAKING_NEWS":
      return "Emergency, Security & Risk, and Breaking News posts play.";
    default:
      return "All levels play (Normal is the lowest — no filtering).";
  }
}
