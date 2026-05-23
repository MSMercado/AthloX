// Static audit of every plan scaffold. Run with:
//   node scripts/audit-scaffolds.mjs
//
// Catches the obvious structural bugs before on-device testing wastes time:
//   - Weekly pattern doesn't have 7 entries
//   - Non-rest day count doesn't match daysPerWeek
//   - Slot pattern references an unknown movement pattern
//   - Day uses an unknown type
//   - Registry references a scaffold that's undefined

import { SCAFFOLDS } from '../src/data/planScaffolds.js';
import { PATTERNS } from '../src/data/exerciseLibrary.js';

const VALID_PATTERNS = new Set(Object.values(PATTERNS));
const VALID_DAY_TYPES = new Set(['rest', 'strength', 'run', 'cardio', 'crossfit', 'hyrox', 'mobility']);
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

let issues = 0;
const totals = { scaffolds: 0, slots: 0 };

function fail(scaffoldId, msg) {
  issues++;
  console.log(`  ❌ [${scaffoldId}] ${msg}`);
}

function ok(msg) {
  console.log(`  ✅ ${msg}`);
}

console.log(`\nAuditing ${Object.keys(SCAFFOLDS).length} scaffolds...\n`);

for (const [key, scaffold] of Object.entries(SCAFFOLDS)) {
  totals.scaffolds++;

  // Registry key must match scaffold id (or vice versa)
  if (scaffold?.id && scaffold.id !== key) {
    fail(key, `registry key "${key}" doesn't match scaffold.id "${scaffold.id}"`);
  }

  if (!scaffold) {
    fail(key, `scaffold is null/undefined`);
    continue;
  }

  // Required fields
  for (const field of ['goalId', 'daysPerWeek', 'phaseTemplate', 'weeklyPattern']) {
    if (scaffold[field] == null) fail(key, `missing required field "${field}"`);
  }

  // weeklyPattern must have 7 entries (Mon-Sun)
  if (!Array.isArray(scaffold.weeklyPattern)) {
    fail(key, `weeklyPattern is not an array`);
    continue;
  }
  if (scaffold.weeklyPattern.length !== 7) {
    fail(key, `weeklyPattern has ${scaffold.weeklyPattern.length} days, expected 7`);
  }

  // Day names should be unique + cover Mon-Sun
  const dayNames = new Set(scaffold.weeklyPattern.map(d => d?.day));
  if (dayNames.size !== scaffold.weeklyPattern.length) {
    fail(key, `weeklyPattern has duplicate day names`);
  }
  for (const expected of DAYS_OF_WEEK) {
    if (!dayNames.has(expected)) {
      fail(key, `weeklyPattern missing day "${expected}"`);
    }
  }

  // Non-rest day count should match daysPerWeek
  const workoutDays = scaffold.weeklyPattern.filter(d => d?.type !== 'rest').length;
  if (workoutDays !== scaffold.daysPerWeek) {
    fail(key, `${workoutDays} non-rest days but daysPerWeek = ${scaffold.daysPerWeek}`);
  }

  // Each day's type must be valid + slots structure must be sane
  for (const day of scaffold.weeklyPattern) {
    if (!VALID_DAY_TYPES.has(day?.type)) {
      fail(key, `day "${day?.day}" has unknown type "${day?.type}"`);
    }

    if (day?.type === 'strength') {
      if (!Array.isArray(day.slots) || day.slots.length === 0) {
        fail(key, `strength day "${day.day}" has no slots`);
        continue;
      }
      for (const slot of day.slots) {
        totals.slots++;
        const patterns = Array.isArray(slot.pattern) ? slot.pattern : [slot.pattern];
        for (const p of patterns) {
          if (!VALID_PATTERNS.has(p)) {
            fail(key, `slot "${slot.id}" on "${day.day}" references unknown pattern "${p}"`);
          }
        }
        if (!['primary', 'secondary', 'accessory'].includes(slot.priority)) {
          fail(key, `slot "${slot.id}" on "${day.day}" has invalid priority "${slot.priority}"`);
        }
      }
    } else if (day?.type === 'run' || day?.type === 'cardio') {
      if (!Array.isArray(day.exercises)) {
        fail(key, `run day "${day.day}" has no exercises array`);
      }
    } else if (day?.type === 'crossfit' || day?.type === 'hyrox') {
      // These get populated from the WOD library at generate time; just need
      // to declare the slot or have an empty exercises array
      if (day.slots == null && day.exercises == null) {
        fail(key, `${day.type} day "${day.day}" has neither slots nor exercises`);
      }
    }
  }
}

console.log(`\nSummary:`);
console.log(`  Scaffolds checked: ${totals.scaffolds}`);
console.log(`  Strength slots:    ${totals.slots}`);
console.log(`  Issues found:      ${issues}`);
process.exit(issues > 0 ? 1 : 0);
