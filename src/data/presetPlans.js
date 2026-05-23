// v2.0 — curated preset plans for the "Start new plan" flow.
//
// Each preset is a ready-to-go plan object built from the same scaffolds
// the AI generator uses. We just stamp the scaffold with a friendly name,
// hand-tuned coach note, and a difficulty/audience description.
//
// At runtime the preset is materialized via materializePresetPlan() which
// reuses planGenerator's deterministic logic so phases / scheduleVariants
// / loading are identical to a freshly-generated plan with the same
// (goal, days, duration). The user can swap to a generated plan later if
// they want more personalization.
//
// Adding more presets: append to PRESET_PLANS. The id must be unique.

import { findScaffold, planPhases } from './planScaffolds';
import {
  EXERCISES, PATTERNS,
  filterByEquipment, filterByPattern, filterByDifficulty,
} from './exerciseLibrary';
import { CROSSFIT_WODS, HYROX_STATIONS, filterWodsByEquipment, filterWodsByDifficulty } from './wodLibrary';

// Same TIER_TO_ITEMS map as planGenerator — kept inline so adding presets
// doesn't depend on the generator module.
const TIER_TO_ITEMS = {
  large_gym:      ['barbell', 'dumbbell', 'kettlebell', 'bench', 'pullup_bar', 'cable', 'machine', 'bands', 'rower', 'jump_rope'],
  commercial_gym: ['barbell', 'dumbbell', 'kettlebell', 'bench', 'pullup_bar', 'cable', 'machine', 'rower'],
  garage_gym:     ['barbell', 'dumbbell', 'bench', 'pullup_bar', 'kettlebell'],
  at_home:        ['dumbbell', 'bench', 'pullup_bar'],
  no_equipment:   [],
};

function normaliseEquipment(equipment) {
  if (!equipment) return [];
  const list = Array.isArray(equipment) ? equipment : [equipment];
  const out = new Set();
  for (const item of list) {
    if (!item) continue;
    const key = String(item).toLowerCase().replace(/\s+/g, '_');
    if (TIER_TO_ITEMS[key]) TIER_TO_ITEMS[key].forEach(i => out.add(i));
    else out.add(key);
  }
  return Array.from(out);
}

// ── Preset catalogue ────────────────────────────────────────────────────────
export const PRESET_PLANS = [
  {
    id:          'couch_to_5k',
    name:        'Couch to 5K',
    tagline:     'Zero to your first 5K in 8 weeks',
    description: 'The classic beginner running plan. Walk-run intervals that gradually build to 30 minutes of continuous running. No prior fitness needed.',
    goalId:      'run_5k',
    goalLabel:   'Run a 5K',
    daysPerWeek: 3,
    durationWeeks: 8,
    level:       'beginner',
    emoji:       '🏃',
    accent:      '#10b981',
  },
  {
    id:          '10k_improver',
    name:        '10K Improver',
    tagline:     'Already running? Hit a faster 10K in 10 weeks',
    description: 'For runners comfortable with 5K who want to crack a faster 10K. Adds tempo, intervals, and a long-run progression.',
    goalId:      'run_10k',
    goalLabel:   'Run a 10K',
    daysPerWeek: 4,
    durationWeeks: 10,
    level:       'intermediate',
    emoji:       '🏃',
    accent:      '#3b82f6',
  },
  {
    id:          'half_marathon_prep',
    name:        'Half Marathon Prep',
    tagline:     'Train confidently for 21.1 km',
    description: 'A balanced 12-week half-marathon plan with base build, threshold work, peak long runs, and a proper taper.',
    goalId:      'run_half',
    goalLabel:   'Run a Half Marathon',
    daysPerWeek: 4,
    durationWeeks: 12,
    level:       'intermediate',
    emoji:       '🏅',
    accent:      '#10b981',
  },
  {
    id:          'marathon_prep_16w',
    name:        'Marathon Prep — 16 weeks',
    tagline:     'Build the engine for 42.2 km',
    description: 'A 16-week marathon block for runners with a solid base. Progressive long runs to 32 km, threshold + easy days, 2-week taper.',
    goalId:      'run_marathon',
    goalLabel:   'Run a Marathon',
    daysPerWeek: 5,
    durationWeeks: 16,
    level:       'advanced',
    emoji:       '🏆',
    accent:      '#ef4444',
  },
  {
    id:          'beginner_strength',
    name:        'Beginner Strength',
    tagline:     'Learn the lifts, build a base — 8 weeks',
    description: 'A 3-day full-body strength plan focused on the big compound lifts. Form first, then progressive overload. No gym? Dumbbells work too.',
    goalId:      'build_muscle',
    goalLabel:   'Build Muscle',
    daysPerWeek: 3,
    durationWeeks: 8,
    level:       'beginner',
    emoji:       '💪',
    accent:      '#3b82f6',
  },
  {
    id:          'ppl_hypertrophy',
    name:        'Push / Pull / Legs Hypertrophy',
    tagline:     'Classic 6-day muscle-building split',
    description: '12-week PPL split for serious gainers. Heavy + volume waves through Foundation, Build, and Peak phases.',
    goalId:      'build_muscle',
    goalLabel:   'Build Muscle',
    daysPerWeek: 6,
    durationWeeks: 12,
    level:       'intermediate',
    emoji:       '💪',
    accent:      '#a855f7',
  },
  {
    id:          'powerlifting_4d',
    name:        'Powerlifting Strength',
    tagline:     'Squat / Bench / Deadlift focus',
    description: 'A 4-day powerlifting-style plan with squat and bench days plus accessory work. Built around heavy compound lifts.',
    goalId:      'get_strong',
    goalLabel:   'Get Stronger',
    daysPerWeek: 4,
    durationWeeks: 12,
    level:       'intermediate',
    emoji:       '🏋️',
    accent:      '#eab308',
  },
  {
    id:          'hyrox_race_prep',
    name:        'Hyrox Race Prep',
    tagline:     '12 weeks to your first Hyrox',
    description: 'Hybrid run + functional fitness plan. Race simulations, sled work, compromised cardio, and a focused taper.',
    goalId:      'hyrox',
    goalLabel:   'Train for Hyrox',
    daysPerWeek: 4,
    durationWeeks: 12,
    level:       'intermediate',
    emoji:       '🔥',
    accent:      '#ef4444',
  },
  {
    id:          'crossfit_starter',
    name:        'CrossFit Starter',
    tagline:     'Learn the WODs, build the engine',
    description: 'An 8-week intro to CrossFit. Benchmark WODs scaled to your level, plus an accessory strength day each week.',
    goalId:      'crossfit',
    goalLabel:   'Train CrossFit',
    daysPerWeek: 3,
    durationWeeks: 8,
    level:       'beginner',
    emoji:       '⚡',
    accent:      '#a855f7',
  },
  {
    id:          'general_fitness_starter',
    name:        'Get Started — General Fitness',
    tagline:     '4 weeks to build the habit',
    description: 'A gentle 3-day full-body plan for anyone returning to exercise or building a baseline. Focus on consistency, not intensity.',
    goalId:      'general',
    goalLabel:   'General Fitness',
    daysPerWeek: 3,
    durationWeeks: 4,
    level:       'beginner',
    emoji:       '✨',
    accent:      '#10b981',
  },
];

// ── Materialize ─────────────────────────────────────────────────────────────
// Build a full plan JSON object from a preset definition + user context.
// Mirrors the deterministic part of planGenerator.generatePlan (we skip the
// LLM coach-note call since presets have hand-written taglines/descriptions).

function populateDay(dayTemplate, phase, ctx, variantIdx, dayIndex) {
  if (dayTemplate.type === 'rest') {
    return { day: dayTemplate.day, type: 'rest', focus: 'Rest', exercises: [] };
  }
  if (dayTemplate.type === 'run' || dayTemplate.type === 'cardio') {
    return {
      day:       dayTemplate.day,
      type:      dayTemplate.type,
      focus:     dayTemplate.focus,
      exercises: dayTemplate.exercises || [],
    };
  }
  if (dayTemplate.type === 'crossfit' || dayTemplate.type === 'hyrox') {
    const basePool = dayTemplate.type === 'hyrox' ? HYROX_STATIONS : CROSSFIT_WODS;
    let pool = filterWodsByEquipment(basePool, ctx.granularEquipment);
    if (pool.length === 0) pool = basePool;
    const byLevel = filterWodsByDifficulty(pool, ctx.level);
    if (byLevel.length > 0) pool = byLevel;
    const seed = dayIndex + variantIdx * 5 + (phase.startWeek || 0);
    const wod = pool[seed % pool.length];
    return {
      day:       dayTemplate.day,
      type:      dayTemplate.type,
      focus:     `${wod.name} — ${wod.focus}`,
      format:    wod.format,
      exercises: wod.movements,
    };
  }
  // Strength day
  const usedNames = new Set();
  const exercises = (dayTemplate.slots || []).map(slot => {
    const candidates = filterByPattern(ctx.usableLibrary, slot.pattern)
      .filter(ex => ex.muscle === slot.muscle || !slot.muscle)
      .filter(ex => (slot.compound === undefined) || (ex.compound === slot.compound))
      .filter(ex => !usedNames.has(ex.name));
    if (candidates.length === 0) {
      const loose = filterByPattern(ctx.usableLibrary, slot.pattern).filter(ex => !usedNames.has(ex.name));
      if (loose.length === 0) return { name: 'Bodyweight Squat', sets: 3, reps: '10', rest: '60s' };
      return formatExercise(loose[variantIdx % loose.length], slot, phase);
    }
    const pick = candidates[variantIdx % candidates.length];
    usedNames.add(pick.name);
    return formatExercise(pick, slot, phase);
  });
  return { day: dayTemplate.day, type: dayTemplate.type, focus: dayTemplate.focus, exercises };
}

function formatExercise(ex, slot, phase) {
  const loading = phase.loading?.[slot.priority] || phase.loading?.base || { sets: 3, reps: '10', rest: '60s' };
  return { name: ex.name, sets: loading.sets, reps: loading.reps, rest: loading.rest };
}

function buildWeekProgressions(phase) {
  const len = phase.endWeek - phase.startWeek + 1;
  const out = [];
  for (let w = 0; w < len; w++) {
    const weekNum = phase.startWeek + w;
    if (phase.name === 'Deload') {
      out.push(`Week ${weekNum}: Deload. Cut sets in half, lift moderate loads.`);
    } else if (w === 0) {
      out.push(`Week ${weekNum}: First week of ${phase.name}. Pick loads you can move with perfect form.`);
    } else if (w === len - 1) {
      out.push(`Week ${weekNum}: Final week of ${phase.name}. Push for a small PR.`);
    } else {
      out.push(`Week ${weekNum}: Add 5 lb or +1 rep vs last week on the top set.`);
    }
  }
  return out;
}

function buildProgressionTags(phase) {
  const len = phase.endWeek - phase.startWeek + 1;
  const out = [];
  for (let w = 0; w < len; w++) {
    if (phase.name === 'Deload') out.push(['Deload', 'Half volume']);
    else if (w === 0)            out.push(['Form focus', `${phase.name} start`]);
    else if (w === len - 1)      out.push(['Top set PR', `${phase.name} peak`]);
    else                          out.push(['+1 rep', '+5 lbs']);
  }
  return out;
}

/**
 * Turn a preset definition into a full plan object matching the schema
 * expected by PlanScreen / dashboards / generators. Equipment + level
 * come from the user's profile.
 *
 * @param {Object} preset       one entry from PRESET_PLANS
 * @param {Object} userContext  { equipment: [...], level: 'beginner' | ... }
 */
export function materializePresetPlan(preset, userContext = {}) {
  const scaffold = findScaffold(preset.goalId, preset.daysPerWeek);
  if (!scaffold) {
    throw new Error(`No scaffold for preset "${preset.id}" (${preset.goalId} × ${preset.daysPerWeek} days)`);
  }

  const granularEquipment = normaliseEquipment(userContext.equipment);
  const level = (userContext.level || preset.level || 'beginner').toLowerCase();
  const usable = filterByDifficulty(filterByEquipment(granularEquipment), level);
  const ctx = { usableLibrary: usable, level, granularEquipment };

  const phases = planPhases(scaffold.phaseTemplate, preset.durationWeeks).map(phase => {
    const variants = [0, 1].map(variantIdx => ({
      schedule: scaffold.weeklyPattern.map((day, dayIndex) =>
        populateDay(day, phase, ctx, variantIdx, dayIndex)),
    }));
    return {
      name:                  phase.name,
      startWeek:             phase.startWeek,
      endWeek:               phase.endWeek,
      focus:                 phase.focus,
      scheduleVariants:      variants,
      weekProgressions:      buildWeekProgressions(phase),
      progressionTagsByWeek: buildProgressionTags(phase),
    };
  });

  return {
    planName:      preset.name,
    presetId:      preset.id,
    goal:          preset.goalLabel,
    durationWeeks: preset.durationWeeks,
    daysPerWeek:   preset.daysPerWeek,
    phases,
    coachNote:     preset.description,
    weeklySchedule: phases[0]?.scheduleVariants?.[0]?.schedule || [],
    startDate:     new Date().toISOString(),
  };
}
