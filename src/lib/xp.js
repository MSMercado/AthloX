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
