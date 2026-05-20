// v1.3.0 — hybrid plan generator.
//
// Replaces the old monolithic LLM-driven plan generation (which broke on
// Groq's 12k-TPM free tier limit). Strategy:
//
//   1. Pick a scaffold by goal + days-per-week from src/data/planScaffolds.js
//   2. Filter the exercise library to what the user can actually do given
//      their equipment + difficulty level
//   3. For each phase × variant × workout day × slot, pick an exercise
//      deterministically (with variant rotation for week-to-week variety),
//      and stamp on sets/reps/rest from the phase loading scheme
//   4. CrossFit / Hyrox days are populated from src/data/wodLibrary.js
//      instead of the strength library
//   5. ONE tiny LLM call for the personal touches the templates can't fake:
//      a fitting planName and a personalized coachNote (~300 tokens out)
//   6. Assemble the result into the existing plan JSON schema so the
//      downstream renderer (PlanScreen, DashboardScreen) needs no changes
//
// Token cost per plan-gen: ~200 input + ~300 output → ~500 total. ~25× under
// the Groq 12k/min cap, so works comfortably on free tier.

import { supabase } from './supabase';
import {
  EXERCISES, PATTERNS,
  filterByEquipment, filterByPattern, filterByDifficulty,
} from '../data/exerciseLibrary';
import { CROSSFIT_WODS, HYROX_STATIONS, filterWodsByEquipment, filterWodsByDifficulty } from '../data/wodLibrary';
import { findScaffold, planPhases } from '../data/planScaffolds';

// Map signup's coarse equipment tiers ("Large Gym", "At Home") to the granular
// equipment items the exercise library expects. Accepts either the tier id
// ('large_gym'), the label ('Large Gym'), or already-granular items.
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
    if (TIER_TO_ITEMS[key]) {
      TIER_TO_ITEMS[key].forEach(i => out.add(i));
    } else {
      // Already a granular item (e.g. 'barbell') — keep as-is
      out.add(key);
    }
  }
  return Array.from(out);
}

// ── Public entry point ───────────────────────────────────────────────────────

/**
 * Generate a complete plan from user inputs.
 *
 * @param {Object} inputs
 * @param {string} inputs.goal          - human-readable goal label, e.g. 'Build Muscle'
 * @param {string} inputs.goalId        - internal id from PlanScreen GOALS, e.g. 'build_muscle'
 * @param {number} inputs.duration      - total weeks (6, 12, 16, 24, ...)
 * @param {number} inputs.daysPerWeek   - 3, 4, 5, 6
 * @param {string} inputs.level         - 'beginner' | 'intermediate' | 'advanced'
 * @param {string[]} inputs.equipment   - e.g. ['barbell', 'dumbbell', 'bench']
 * @param {string} inputs.firstName     - for the coach note
 *
 * @returns {Promise<Object>} a plan JSON matching the v1.1.0+ schema
 *   (planName, goal, durationWeeks, daysPerWeek, phases[], coachNote, weeklySchedule)
 */
export async function generatePlan(inputs) {
  const { goalId, goal, duration, daysPerWeek, level, equipment, firstName } = inputs;

  const scaffold = findScaffold(goalId, daysPerWeek);
  if (!scaffold) {
    throw new Error(`No plan template available yet for "${goal}" at ${daysPerWeek} days/week. Try a different combination — more templates ship soon.`);
  }

  // Filter the exercise library down to what this user can actually do.
  // First expand tier-level equipment ('Large Gym' → barbell, dumbbell, …),
  // then filter by what they have + their difficulty.
  const granularEquipment = normaliseEquipment(equipment);
  const usable = filterByDifficulty(
    filterByEquipment(granularEquipment),
    level || 'beginner',
  );

  // Shared context handed to every day populator. Carries the raw level +
  // equipment so CrossFit / Hyrox days can filter the WOD pool too.
  const ctx = {
    usableLibrary:    usable,
    level:            level || 'beginner',
    granularEquipment,
  };

  // Stretch the phase template across the requested duration.
  const phases = planPhases(scaffold.phaseTemplate, duration).map(phase => {
    // 2 variants per phase — alternates between week 1/3/5... and 2/4/6...
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

  // Tiny LLM call for the planName + personal coachNote. Falls back to a
  // sensible default if the LLM fails — never blocks the plan.
  const { planName, coachNote } = await fetchPersonalTouches({
    goal, duration, daysPerWeek, level, firstName,
  }).catch(() => ({
    planName: `${duration}-Week ${goal} Plan`,
    coachNote: `Welcome, ${firstName || 'athlete'}. Stay consistent for ${duration} weeks and the results will follow.`,
  }));

  return {
    planName,
    goal,
    durationWeeks: duration,
    daysPerWeek,
    phases,
    coachNote,
    weeklySchedule: phases[0]?.scheduleVariants?.[0]?.schedule || [],
    startDate: new Date().toISOString(),
  };
}

// ── Internals ────────────────────────────────────────────────────────────────

/**
 * Populate a single day in a phase with exercises chosen from the candidate
 * pool. Rest days short-circuit. CrossFit / Hyrox days pull from the WOD
 * library. Strength days resolve slot-by-slot.
 *
 * @param {number} dayIndex - position of the day in the 7-day weeklyPattern,
 *   used to give each CrossFit / Hyrox day in a week a DISTINCT WOD.
 */
function populateDay(dayTemplate, phase, ctx, variantIdx, dayIndex) {
  const usableLibrary = ctx.usableLibrary;

  if (dayTemplate.type === 'rest') {
    return { day: dayTemplate.day, type: 'rest', focus: 'Rest', exercises: [] };
  }

  if (dayTemplate.type === 'run' || dayTemplate.type === 'cardio') {
    // Running days carry their exercise list directly on the scaffold
    // template (warm-up / main set / cool-down). Pass through unchanged.
    return {
      day:       dayTemplate.day,
      type:      dayTemplate.type,
      focus:     dayTemplate.focus,
      exercises: dayTemplate.exercises || [],
    };
  }

  if (dayTemplate.type === 'crossfit' || dayTemplate.type === 'hyrox') {
    return pickWodForDay(dayTemplate, variantIdx, phase, dayIndex, ctx);
  }

  // Strength day — fill each slot.
  const usedNames = new Set();
  const exercises = dayTemplate.slots.map(slot => {
    const candidates = filterByPattern(usableLibrary, slot.pattern)
      .filter(ex => ex.muscle === slot.muscle || !slot.muscle)
      .filter(ex => (slot.compound === undefined) || (ex.compound === slot.compound))
      .filter(ex => !usedNames.has(ex.name));

    if (candidates.length === 0) {
      // Fall back: drop the muscle constraint, then the compound constraint.
      const loose = filterByPattern(usableLibrary, slot.pattern).filter(ex => !usedNames.has(ex.name));
      if (loose.length === 0) {
        return { name: 'Bodyweight Squat', sets: 3, reps: '10', rest: '60s' }; // emergency fallback
      }
      return formatExercise(loose[variantIdx % loose.length], slot, phase);
    }

    // Variant rotation: use variantIdx to pick a different candidate per variant.
    const pick = candidates[variantIdx % candidates.length];
    usedNames.add(pick.name);
    return formatExercise(pick, slot, phase);
  });

  return {
    day:       dayTemplate.day,
    type:      dayTemplate.type,
    focus:     dayTemplate.focus,
    exercises,
  };
}

/**
 * Stamp sets/reps/rest onto a picked exercise based on slot priority + phase.
 */
function formatExercise(ex, slot, phase) {
  const loading = phase.loading?.[slot.priority] || phase.loading?.base || { sets: 3, reps: '10', rest: '60s' };
  return {
    name: ex.name,
    sets: loading.sets,
    reps: loading.reps,
    rest: loading.rest,
  };
}

/**
 * Pick a WOD for a CrossFit / Hyrox day.
 *
 * Three dimensions of variation, so no two days feel the same:
 *   - dayIndex   → distinct WOD for each CrossFit day WITHIN a week
 *   - variantIdx → distinct WODs week-to-week (variant A vs B)
 *   - phase      → distinct WODs phase-to-phase
 *
 * The pool is also filtered to the user's level + equipment so a beginner
 * doesn't get "Murph" and a no-equipment user doesn't get a barbell WOD.
 * Filters degrade gracefully — if a filter empties the pool, it's dropped.
 */
function pickWodForDay(dayTemplate, variantIdx, phase, dayIndex, ctx) {
  const basePool = dayTemplate.type === 'hyrox' ? HYROX_STATIONS : CROSSFIT_WODS;

  // Filter to equipment, then difficulty — but never allow an empty pool.
  let pool = filterWodsByEquipment(basePool, ctx.granularEquipment);
  if (pool.length === 0) pool = basePool;
  const byLevel = filterWodsByDifficulty(pool, ctx.level);
  if (byLevel.length > 0) pool = byLevel;

  // Seed combines all three variation dimensions. dayIndex (0-6) spreads days
  // within a week; variantIdx*5 spreads week A vs B; phase.startWeek spreads
  // across phases. The *5 stride keeps consecutive weeks from colliding.
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

/**
 * Build the per-week progression notes shown in the UI under each week.
 */
function buildWeekProgressions(phase) {
  const len = phase.endWeek - phase.startWeek + 1;
  const out = [];
  for (let w = 0; w < len; w++) {
    const weekNum = phase.startWeek + w;
    if (phase.name === 'Deload') {
      out.push(`Week ${weekNum}: Deload. Cut sets in half, lift moderate loads, focus on movement quality and recovery.`);
    } else if (w === 0) {
      out.push(`Week ${weekNum}: First week of ${phase.name}. Pick loads you can move with perfect form — leave 2-3 reps in the tank on every set.`);
    } else if (w === len - 1) {
      out.push(`Week ${weekNum}: Final week of ${phase.name}. Push for a small PR — +5 lb on the bar, +1 rep on the top set, or shorter rest.`);
    } else {
      out.push(`Week ${weekNum}: Add 5 lb or +1 rep to your top set on every compound lift vs last week.`);
    }
  }
  return out;
}

/**
 * Short punchy tags shown as week badges (e.g. "+1 rep", "Deload").
 */
function buildProgressionTags(phase) {
  const len = phase.endWeek - phase.startWeek + 1;
  const out = [];
  for (let w = 0; w < len; w++) {
    if (phase.name === 'Deload') {
      out.push(['Deload', 'Half volume']);
    } else if (w === 0) {
      out.push(['Form focus', `${phase.name} start`]);
    } else if (w === len - 1) {
      out.push(['Top set PR', `${phase.name} peak`]);
    } else {
      out.push(['+1 rep', '+5 lbs']);
    }
  }
  return out;
}

// ── Personal touches via tiny LLM call ──────────────────────────────────────

/**
 * Ask the LLM only for the personal touches we can't template:
 *   - A creative planName ("12-Week Brick Builder" beats "12-Week Build Muscle Plan")
 *   - A motivating coachNote addressed to the user by name
 *
 * The prompt is ~200 tokens and the output ~300, well under any free-tier limit.
 */
async function fetchPersonalTouches({ goal, duration, daysPerWeek, level, firstName }) {
  const prompt = `Write a short JSON object for a fitness plan with two fields:
- "planName": a punchy 3-6 word plan name (e.g. "12-Week Strength Surge", "Brick Builder", "Hybrid Engine").
- "coachNote": a 2-3 sentence motivating message addressed to ${firstName || 'the athlete'} by name. Mention the goal and duration. Warm, confident, no fluff.

Plan details:
- Goal: ${goal}
- Duration: ${duration} weeks
- Days per week: ${daysPerWeek}
- Level: ${level || 'beginner'}

Respond with ONLY a JSON object: {"planName":"...","coachNote":"..."}`;

  const { data, error } = await supabase.functions.invoke('groq-proxy', {
    body: {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    },
  });
  if (error) throw new Error(error.message || 'Edge function error');
  if (data?.error) throw new Error(data.error?.message || data.error);

  const raw = data?.choices?.[0]?.message?.content?.trim() || '';
  const parsed = JSON.parse(raw);
  return {
    planName:  parsed.planName  || `${duration}-Week ${goal} Plan`,
    coachNote: parsed.coachNote || `Let's get to work, ${firstName || 'athlete'}.`,
  };
}
