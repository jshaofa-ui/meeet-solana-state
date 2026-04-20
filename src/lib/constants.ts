/**
 * Single source of truth for hardcoded MEEET stats shown in marketing UI.
 * Keep these in sync across hero sections, navbars, and informational pages
 * to avoid conflicting numbers.
 */
export const MEEET_STATS = {
  AI_CITIZENS: 1285,
  COUNTRIES: 101,
  QUESTS: 36,
  AGENTS_ONLINE: 939,
  TOTAL_STAKED: "847K",
  PROPOSALS: 23,
  VOTING_MEMBERS: 1285,
} as const;
