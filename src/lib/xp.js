// ── XP & Level System ─────────────────────────────────────────────────────────

export const LEVELS = [
  { level: 1, xpRequired: 0,     title: 'Noob',     emoji: '😅' },
  { level: 2, xpRequired: 500,   title: 'Rookie',   emoji: '🌱' },
  { level: 3, xpRequired: 1200,  title: 'Grinder',  emoji: '🔥' },
  { level: 4, xpRequired: 2500,  title: 'Athlete',  emoji: '💪' },
  { level: 5, xpRequired: 5000,  title: 'Warrior',  emoji: '⚔️' },
  { level: 6, xpRequired: 9000,  title: 'Champion', emoji: '🏆' },
  { level: 7, xpRequired: 15000, title: 'Elite',    emoji: '💎' },
  { level: 8, xpRequired: 25000, title: 'Legend',   emoji: '👑' },
];

export const XP_REWARDS = {
  COMPLETE_WORKOUT: 100,
  LOG_RUN:          80,
  STREAK_DAY:       25,
  FIRST_WORKOUT:    200,
  COMPLETE_WEEK:    150,
};

// ── Effort-based XP helpers ──────────────────────────────────────────────────
// Used by TrackScreen so users can't farm XP by starting + stopping immediately.
// XP is now proportional to actual work done (sets completed / distance / time).

/**
 * XP for a strength workout. Scales with completion ratio (doneSets / totalSets)
 * with anti-exploit gates: must take at least 1 minute AND complete >= 25% of sets.
 */
export function computeStrengthXP(doneSets, totalSets, elapsedSec) {
  if (!doneSets || doneSets < 1)   return 0;
  if (elapsedSec < 60)             return 0;   // less than a minute → likely exploit
  const ratio = totalSets > 0 ? Math.min(doneSets / totalSets, 1) : 1;
  if (ratio < 0.25)                return 0;   // less than 25% done → no XP
  return Math.round(XP_REWARDS.COMPLETE_WORKOUT * ratio);
}

/**
 * XP for a cardio activity (run / walk / bike / hike). Composed of distance XP
 * + a smaller time component. Anti-exploit gates: must move at least 0.5 km
 * AND last at least 2 minutes (or 5 minutes if distance is short).
 */
export function computeCardioXP(distanceKm, elapsedSec) {
  if (!elapsedSec || elapsedSec < 120)              return 0;  // < 2 min → no XP
  if (distanceKm < 0.5 && elapsedSec < 300)         return 0;  // short + slow → no XP
  const distXP = Math.round((distanceKm || 0) * 10);           // 10 XP per km
  const timeXP = Math.round((elapsedSec / 60) * 1);            // 1 XP per minute
  return Math.max(distXP + timeXP, 5);                         // floor 5 if past the gate
}

// Returns full level info for a given XP value
export function getLevelInfo(xp = 0) {
  let currentIdx = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xpRequired) { currentIdx = i; break; }
  }
  const current        = LEVELS[currentIdx];
  const next           = LEVELS[currentIdx + 1] || null;
  const xpIntoLevel    = xp - current.xpRequired;
  const xpForNextLevel = next ? next.xpRequired - current.xpRequired : 1;
  const progress       = next ? Math.min(xpIntoLevel / xpForNextLevel, 1) : 1;

  return { current, next, xpIntoLevel, xpForNextLevel, progress };
}

// Returns true if going from oldXP to newXP crosses a level threshold
export function didLevelUp(oldXP, newXP) {
  const oldLevel = getLevelInfo(oldXP).current.level;
  const newLevel = getLevelInfo(newXP).current.level;
  return newLevel > oldLevel;
}
