// v1.3.0 — pre-designed plan scaffolds that the hybrid generator fills in.
//
// A scaffold defines the SHAPE of a plan:
//   - which phases exist + their loading scheme (sets/reps/rest)
//   - the weekly day pattern (e.g. PPLU = Push/Pull/Legs/Upper)
//   - the SLOTS each workout day needs (e.g. "compound horizontal push for chest")
//
// It does NOT name specific exercises — that's the generator's job, which picks
// from the exercise library (src/data/exerciseLibrary.js) based on user equipment
// and level.
//
// The generator scales the phaseTemplate to match the user's chosen duration:
//   - 6 weeks   → each phase gets ceil(6 / 3) = 2 weeks
//   - 12 weeks  → 4 weeks each
//   - 16 weeks  → 4/6/4 with the longest phase taking the extra
//   - 24 weeks  → 6/10/6 plus deload weeks inserted between phases
//
// Slot shape:
//   {
//     id:        'p1',
//     pattern:   'horizontal-push' | ['horizontal-push','incline-push'],
//     muscle:    'chest',
//     compound:  true,
//     priority:  'primary' | 'secondary' | 'accessory',  // sets/reps modifier
//   }
//
// 'primary' slots get the phase's heavier sets×reps. 'accessory' slots get
// higher-rep, shorter-rest sets.

import { PATTERNS } from './exerciseLibrary';

const P = PATTERNS;

// ── Per-priority loading overrides ───────────────────────────────────────────
// Applied on top of the phase's base loading. e.g. accessory in Peak phase
// uses moderate-rep instead of the phase's low-rep base.
const PRIORITY_LOADING = {
  primary:   { repsBias: 'low',   restBias: 'long'   },
  secondary: { repsBias: 'mid',   restBias: 'medium' },
  accessory: { repsBias: 'high',  restBias: 'short'  },
};

// Rep ranges per (phase, repsBias) combo. Phase = Foundation | Build | Peak.
// Picked to match standard hypertrophy / strength programming.
export const PHASE_LOADING = {
  Foundation: {
    base: { sets: 3, reps: '10-12', rest: '75s' },
    primary:   { sets: 3, reps: '10-12', rest: '90s' },
    secondary: { sets: 3, reps: '10-12', rest: '75s' },
    accessory: { sets: 3, reps: '12-15', rest: '60s' },
    focus: 'Master form, build a base. Light to moderate loads.',
  },
  Build: {
    base: { sets: 4, reps: '8-10', rest: '90s' },
    primary:   { sets: 4, reps: '6-8',  rest: '120s' },
    secondary: { sets: 4, reps: '8-10', rest: '90s'  },
    accessory: { sets: 3, reps: '10-12',rest: '60s'  },
    focus: 'Hypertrophy phase. Add volume + load week over week.',
  },
  Peak: {
    base: { sets: 4, reps: '6-8', rest: '120s' },
    primary:   { sets: 5, reps: '4-6',  rest: '150s' },
    secondary: { sets: 4, reps: '6-8',  rest: '120s' },
    accessory: { sets: 3, reps: '8-12', rest: '75s'  },
    focus: 'Strength + size peak. Heavier loads, lower reps.',
  },
  Deload: {
    base: { sets: 2, reps: '8-10', rest: '60s' },
    primary:   { sets: 2, reps: '8-10', rest: '60s' },
    secondary: { sets: 2, reps: '8-10', rest: '60s' },
    accessory: { sets: 2, reps: '10-12',rest: '45s' },
    focus: 'Recovery week. Half the volume at moderate intensity.',
  },
};

// ── SCAFFOLD: Build Muscle / 4 days per week ────────────────────────────────
// Classic Push / Pull / Legs / Upper split. Rest on Wed, Sat, Sun.
export const BUILD_MUSCLE_4D = {
  id: 'build_muscle_4d',
  goalId: 'build_muscle',
  goalLabel: 'Build Muscle',
  daysPerWeek: 4,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    {
      day: 'Monday', type: 'strength', focus: 'Push — chest, shoulders, triceps',
      slots: [
        { id: 'm1', pattern: P.HORIZONTAL_PUSH, muscle: 'chest',     compound: true,  priority: 'primary'   },
        { id: 'm2', pattern: P.INCLINE_PUSH,    muscle: 'chest',     compound: true,  priority: 'secondary' },
        { id: 'm3', pattern: P.VERTICAL_PUSH,   muscle: 'shoulders', compound: true,  priority: 'secondary' },
        { id: 'm4', pattern: P.ISOLATION_TRI,   muscle: 'triceps',   compound: false, priority: 'accessory' },
        { id: 'm5', pattern: P.ISOLATION_DELT,  muscle: 'shoulders', compound: false, priority: 'accessory' },
      ],
    },
    {
      day: 'Tuesday', type: 'strength', focus: 'Pull — back, biceps',
      slots: [
        { id: 't1', pattern: P.VERTICAL_PULL,   muscle: 'back',   compound: true,  priority: 'primary'   },
        { id: 't2', pattern: P.HORIZONTAL_PULL, muscle: 'back',   compound: true,  priority: 'secondary' },
        { id: 't3', pattern: [P.HORIZONTAL_PULL, P.VERTICAL_PULL], muscle: 'back', compound: true,  priority: 'secondary' },
        { id: 't4', pattern: P.ISOLATION_BICEP, muscle: 'biceps', compound: false, priority: 'accessory' },
        { id: 't5', pattern: P.ISOLATION_DELT,  muscle: 'shoulders', compound: false, priority: 'accessory' },
      ],
    },
    { day: 'Wednesday', type: 'rest', focus: 'Rest', slots: [] },
    {
      day: 'Thursday', type: 'strength', focus: 'Legs — quads, hamstrings, glutes',
      slots: [
        { id: 'th1', pattern: P.SQUAT,          muscle: 'quads',      compound: true,  priority: 'primary'   },
        { id: 'th2', pattern: P.HINGE,          muscle: 'hamstrings', compound: true,  priority: 'primary'   },
        { id: 'th3', pattern: P.LUNGE,          muscle: 'quads',      compound: true,  priority: 'secondary' },
        { id: 'th4', pattern: P.ISOLATION_LEG,  muscle: 'hamstrings', compound: false, priority: 'accessory' },
        { id: 'th5', pattern: P.CALF,           muscle: 'calves',     compound: false, priority: 'accessory' },
      ],
    },
    {
      day: 'Friday', type: 'strength', focus: 'Upper — full upper body',
      slots: [
        { id: 'f1', pattern: P.HORIZONTAL_PUSH, muscle: 'chest',     compound: true,  priority: 'secondary' },
        { id: 'f2', pattern: P.HORIZONTAL_PULL, muscle: 'back',      compound: true,  priority: 'secondary' },
        { id: 'f3', pattern: P.ISOLATION_BICEP, muscle: 'biceps',    compound: false, priority: 'accessory' },
        { id: 'f4', pattern: P.ISOLATION_TRI,   muscle: 'triceps',   compound: false, priority: 'accessory' },
        { id: 'f5', pattern: P.CORE_ANTI,       muscle: 'core',      compound: false, priority: 'accessory' },
      ],
    },
    { day: 'Saturday', type: 'rest', focus: 'Rest', slots: [] },
    { day: 'Sunday',   type: 'rest', focus: 'Rest', slots: [] },
  ],
};

// ── Day-template helpers ────────────────────────────────────────────────────
// Compact builders so each scaffold doesn't have to spell out the same slot
// arrays five times. Each helper returns a fully-formed day template.

const REST = (day) => ({ day, type: 'rest', focus: 'Rest', slots: [] });

const PUSH_DAY = (day, focus = 'Push — chest, shoulders, triceps') => ({
  day, type: 'strength', focus,
  slots: [
    { id: 'p1', pattern: P.HORIZONTAL_PUSH, muscle: 'chest',     compound: true,  priority: 'primary'   },
    { id: 'p2', pattern: P.INCLINE_PUSH,    muscle: 'chest',     compound: true,  priority: 'secondary' },
    { id: 'p3', pattern: P.VERTICAL_PUSH,   muscle: 'shoulders', compound: true,  priority: 'secondary' },
    { id: 'p4', pattern: P.ISOLATION_TRI,   muscle: 'triceps',   compound: false, priority: 'accessory' },
    { id: 'p5', pattern: P.ISOLATION_DELT,  muscle: 'shoulders', compound: false, priority: 'accessory' },
  ],
});

const PULL_DAY = (day, focus = 'Pull — back, biceps') => ({
  day, type: 'strength', focus,
  slots: [
    { id: 'l1', pattern: P.VERTICAL_PULL,   muscle: 'back',   compound: true,  priority: 'primary'   },
    { id: 'l2', pattern: P.HORIZONTAL_PULL, muscle: 'back',   compound: true,  priority: 'secondary' },
    { id: 'l3', pattern: [P.HORIZONTAL_PULL, P.VERTICAL_PULL], muscle: 'back', compound: true,  priority: 'secondary' },
    { id: 'l4', pattern: P.ISOLATION_BICEP, muscle: 'biceps', compound: false, priority: 'accessory' },
    { id: 'l5', pattern: P.ISOLATION_DELT,  muscle: 'shoulders', compound: false, priority: 'accessory' },
  ],
});

const LEG_DAY = (day, focus = 'Legs — quads, hamstrings, glutes') => ({
  day, type: 'strength', focus,
  slots: [
    { id: 'g1', pattern: P.SQUAT,         muscle: 'quads',      compound: true,  priority: 'primary'   },
    { id: 'g2', pattern: P.HINGE,         muscle: 'hamstrings', compound: true,  priority: 'primary'   },
    { id: 'g3', pattern: P.LUNGE,         muscle: 'quads',      compound: true,  priority: 'secondary' },
    { id: 'g4', pattern: P.ISOLATION_LEG, muscle: 'hamstrings', compound: false, priority: 'accessory' },
    { id: 'g5', pattern: P.CALF,          muscle: 'calves',     compound: false, priority: 'accessory' },
  ],
});

const UPPER_DAY = (day, focus = 'Upper — full upper body') => ({
  day, type: 'strength', focus,
  slots: [
    { id: 'u1', pattern: P.HORIZONTAL_PUSH, muscle: 'chest',  compound: true,  priority: 'secondary' },
    { id: 'u2', pattern: P.HORIZONTAL_PULL, muscle: 'back',   compound: true,  priority: 'secondary' },
    { id: 'u3', pattern: P.VERTICAL_PUSH,   muscle: 'shoulders', compound: true,  priority: 'secondary' },
    { id: 'u4', pattern: P.ISOLATION_BICEP, muscle: 'biceps', compound: false, priority: 'accessory' },
    { id: 'u5', pattern: P.ISOLATION_TRI,   muscle: 'triceps',compound: false, priority: 'accessory' },
  ],
});

const LOWER_DAY = (day, focus = 'Lower — full lower body') => ({
  day, type: 'strength', focus,
  slots: [
    { id: 'd1', pattern: P.SQUAT,         muscle: 'quads',      compound: true,  priority: 'primary'   },
    { id: 'd2', pattern: P.HINGE,         muscle: 'hamstrings', compound: true,  priority: 'secondary' },
    { id: 'd3', pattern: P.LUNGE,         muscle: 'quads',      compound: true,  priority: 'secondary' },
    { id: 'd4', pattern: P.ISOLATION_LEG, muscle: 'quads',      compound: false, priority: 'accessory' },
    { id: 'd5', pattern: P.CORE_ANTI,     muscle: 'core',       compound: false, priority: 'accessory' },
  ],
});

const FULL_BODY_DAY = (day, focus = 'Full body') => ({
  day, type: 'strength', focus,
  slots: [
    { id: 'fb1', pattern: P.SQUAT,           muscle: 'quads', compound: true, priority: 'primary'   },
    { id: 'fb2', pattern: P.HORIZONTAL_PUSH, muscle: 'chest', compound: true, priority: 'secondary' },
    { id: 'fb3', pattern: P.HORIZONTAL_PULL, muscle: 'back',  compound: true, priority: 'secondary' },
    { id: 'fb4', pattern: P.HINGE,           muscle: 'hamstrings', compound: true, priority: 'secondary' },
    { id: 'fb5', pattern: P.CORE_ANTI,       muscle: 'core',  compound: false, priority: 'accessory' },
  ],
});

// Running-day templates: no slots — just a fixed exercise list. The generator's
// `populateDay` rest/strength branches skip slots when `type === 'run'`, so we
// pre-fill `exercises` directly. Sets/reps are replaced by duration/pace.
const RUN_EASY = (day) => ({
  day, type: 'run', focus: 'Easy run — Zone 2 conversational pace',
  exercises: [{ name: 'Easy Run', duration: '30-45 min', pace: 'easy' }],
});

const RUN_TEMPO = (day) => ({
  day, type: 'run', focus: 'Tempo run — comfortably hard',
  exercises: [
    { name: 'Warm-up',    duration: '10 min', pace: 'easy' },
    { name: 'Tempo',      duration: '20 min', pace: 'tempo (could speak 3 words)' },
    { name: 'Cool-down',  duration: '10 min', pace: 'easy' },
  ],
});

const RUN_INTERVALS = (day) => ({
  day, type: 'run', focus: 'Intervals — VO2 max',
  exercises: [
    { name: 'Warm-up',          duration: '10 min', pace: 'easy' },
    { name: '6 × 400 m',        pace: '5K race pace', rest: '90s between' },
    { name: 'Cool-down',        duration: '10 min', pace: 'easy' },
  ],
});

const RUN_LONG = (day, distance = '8-12 km') => ({
  day, type: 'run', focus: 'Long run — endurance',
  exercises: [{ name: 'Long Run', distance, pace: 'easy / conversational' }],
});

// Recovery jog — very easy, short. Used to add running frequency on 5/6-day
// plans without piling on hard sessions.
const RUN_RECOVERY = (day) => ({
  day, type: 'run', focus: 'Recovery jog — very easy',
  exercises: [{ name: 'Recovery Jog', duration: '20-30 min', pace: 'very easy' }],
});

const RUN_HILL = (day) => ({
  day, type: 'run', focus: 'Hill repeats — power',
  exercises: [
    { name: 'Warm-up',     duration: '10 min', pace: 'easy' },
    { name: '8 × 60s hill', pace: 'hard up, jog down', rest: 'walk down' },
    { name: 'Cool-down',   duration: '10 min', pace: 'easy' },
  ],
});

const CROSSFIT_DAY = (day, focus = 'CrossFit WOD') => ({
  day, type: 'crossfit', focus, slots: [],
});

const HYROX_DAY = (day, focus = 'Hyrox session') => ({
  day, type: 'hyrox', focus, slots: [],
});

// Powerlifting-style single-lift focus days — used by Get Stronger scaffolds.
const SQUAT_DAY = (day, focus = 'Squat focus') => ({
  day, type: 'strength', focus,
  slots: [
    { id: 's1', pattern: P.SQUAT,     muscle: 'quads',      compound: true,  priority: 'primary'   },
    { id: 's2', pattern: P.HINGE,     muscle: 'hamstrings', compound: true,  priority: 'secondary' },
    { id: 's3', pattern: P.LUNGE,     muscle: 'quads',      compound: true,  priority: 'secondary' },
    { id: 's4', pattern: P.CALF,      muscle: 'calves',     compound: false, priority: 'accessory' },
    { id: 's5', pattern: P.CORE_ANTI, muscle: 'core',       compound: false, priority: 'accessory' },
  ],
});

const BENCH_DAY = (day, focus = 'Bench focus') => ({
  day, type: 'strength', focus,
  slots: [
    { id: 'b1', pattern: P.HORIZONTAL_PUSH, muscle: 'chest',     compound: true,  priority: 'primary'   },
    { id: 'b2', pattern: P.HORIZONTAL_PULL, muscle: 'back',      compound: true,  priority: 'secondary' },
    { id: 'b3', pattern: P.VERTICAL_PUSH,   muscle: 'shoulders', compound: true,  priority: 'secondary' },
    { id: 'b4', pattern: P.ISOLATION_TRI,   muscle: 'triceps',   compound: false, priority: 'accessory' },
    { id: 'b5', pattern: P.ISOLATION_BICEP, muscle: 'biceps',    compound: false, priority: 'accessory' },
  ],
});

const DEADLIFT_DAY = (day, focus = 'Deadlift focus') => ({
  day, type: 'strength', focus,
  slots: [
    { id: 'x1', pattern: P.HINGE,         muscle: 'hamstrings', compound: true,  priority: 'primary'   },
    { id: 'x2', pattern: P.SQUAT,         muscle: 'quads',      compound: true,  priority: 'secondary' },
    { id: 'x3', pattern: P.VERTICAL_PULL, muscle: 'back',       compound: true,  priority: 'secondary' },
    { id: 'x4', pattern: P.ISOLATION_LEG, muscle: 'hamstrings', compound: false, priority: 'accessory' },
    { id: 'x5', pattern: P.CORE_ANTI,     muscle: 'core',       compound: false, priority: 'accessory' },
  ],
});

// Conditioning circuit — full-body, accessory loading so reps stay high.
const CONDITIONING_DAY = (day, focus = 'Conditioning circuit') => ({
  day, type: 'strength', focus,
  slots: [
    { id: 'c1', pattern: P.SQUAT,           muscle: 'quads',      compound: true,  priority: 'accessory' },
    { id: 'c2', pattern: P.HORIZONTAL_PUSH, muscle: 'chest',      compound: true,  priority: 'accessory' },
    { id: 'c3', pattern: P.HINGE,           muscle: 'hamstrings', compound: true,  priority: 'accessory' },
    { id: 'c4', pattern: P.HORIZONTAL_PULL, muscle: 'back',       compound: true,  priority: 'accessory' },
    { id: 'c5', pattern: P.CORE_ANTI,       muscle: 'core',       compound: false, priority: 'accessory' },
  ],
});

// Phase loading for goal types that want different rep ranges than the default
// hypertrophy-focused PHASE_LOADING. The generator picks loading by phase name,
// so we override via the scaffold's `loadingOverride` (handled in v1.3.1+ — for
// now we use the default PHASE_LOADING which is fine for all current goals).

// ── SCAFFOLDS — Build Muscle ────────────────────────────────────────────────
const BUILD_MUSCLE_3D = {
  id: 'build_muscle_3d', goalId: 'build_muscle', goalLabel: 'Build Muscle', daysPerWeek: 3,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    PUSH_DAY('Monday'),
    REST('Tuesday'),
    PULL_DAY('Wednesday'),
    REST('Thursday'),
    LEG_DAY('Friday'),
    REST('Saturday'),
    REST('Sunday'),
  ],
};

const BUILD_MUSCLE_5D = {
  id: 'build_muscle_5d', goalId: 'build_muscle', goalLabel: 'Build Muscle', daysPerWeek: 5,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    PUSH_DAY('Monday'),
    PULL_DAY('Tuesday'),
    LEG_DAY('Wednesday'),
    REST('Thursday'),
    UPPER_DAY('Friday'),
    LOWER_DAY('Saturday'),
    REST('Sunday'),
  ],
};

const BUILD_MUSCLE_6D = {
  id: 'build_muscle_6d', goalId: 'build_muscle', goalLabel: 'Build Muscle', daysPerWeek: 6,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    PUSH_DAY('Monday',    'Push — heavy'),
    PULL_DAY('Tuesday',   'Pull — heavy'),
    LEG_DAY('Wednesday',  'Legs — heavy'),
    PUSH_DAY('Thursday',  'Push — volume'),
    PULL_DAY('Friday',    'Pull — volume'),
    LEG_DAY('Saturday',   'Legs — volume'),
    REST('Sunday'),
  ],
};

// ── SCAFFOLDS — Get Stronger (Powerlifting-style) ──────────────────────────
const GET_STRONG_3D = {
  id: 'get_strong_3d', goalId: 'get_strong', goalLabel: 'Get Stronger', daysPerWeek: 3,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    {
      day: 'Monday', type: 'strength', focus: 'Squat focus',
      slots: [
        { id: 's1', pattern: P.SQUAT,           muscle: 'quads', compound: true,  priority: 'primary' },
        { id: 's2', pattern: P.HINGE,           muscle: 'hamstrings', compound: true,  priority: 'secondary' },
        { id: 's3', pattern: P.LUNGE,           muscle: 'quads', compound: true,  priority: 'secondary' },
        { id: 's4', pattern: P.CORE_ANTI,       muscle: 'core',  compound: false, priority: 'accessory' },
      ],
    },
    REST('Tuesday'),
    {
      day: 'Wednesday', type: 'strength', focus: 'Bench focus',
      slots: [
        { id: 'b1', pattern: P.HORIZONTAL_PUSH, muscle: 'chest',     compound: true,  priority: 'primary' },
        { id: 'b2', pattern: P.HORIZONTAL_PULL, muscle: 'back',      compound: true,  priority: 'secondary' },
        { id: 'b3', pattern: P.VERTICAL_PUSH,   muscle: 'shoulders', compound: true,  priority: 'secondary' },
        { id: 'b4', pattern: P.ISOLATION_TRI,   muscle: 'triceps',   compound: false, priority: 'accessory' },
      ],
    },
    REST('Thursday'),
    {
      day: 'Friday', type: 'strength', focus: 'Deadlift focus',
      slots: [
        { id: 'd1', pattern: P.HINGE,           muscle: 'hamstrings', compound: true,  priority: 'primary' },
        { id: 'd2', pattern: P.SQUAT,           muscle: 'quads',      compound: true,  priority: 'secondary' },
        { id: 'd3', pattern: P.VERTICAL_PULL,   muscle: 'back',       compound: true,  priority: 'secondary' },
        { id: 'd4', pattern: P.CORE_ANTI,       muscle: 'core',       compound: false, priority: 'accessory' },
      ],
    },
    REST('Saturday'), REST('Sunday'),
  ],
};

const GET_STRONG_4D = {
  id: 'get_strong_4d', goalId: 'get_strong', goalLabel: 'Get Stronger', daysPerWeek: 4,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    UPPER_DAY('Monday',   'Upper — heavy (low rep)'),
    LOWER_DAY('Tuesday',  'Lower — heavy (low rep)'),
    REST('Wednesday'),
    UPPER_DAY('Thursday', 'Upper — moderate (volume)'),
    LOWER_DAY('Friday',   'Lower — moderate (volume)'),
    REST('Saturday'), REST('Sunday'),
  ],
};

// ── SCAFFOLDS — Lose Fat (mix strength + conditioning) ──────────────────────
const LOSE_FAT_3D = {
  id: 'lose_fat_3d', goalId: 'lose_fat', goalLabel: 'Lose Fat', daysPerWeek: 3,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    FULL_BODY_DAY('Monday', 'Full body strength'),
    REST('Tuesday'),
    FULL_BODY_DAY('Wednesday', 'Full body conditioning'),
    REST('Thursday'),
    FULL_BODY_DAY('Friday', 'Full body — circuits'),
    REST('Saturday'), REST('Sunday'),
  ],
};

const LOSE_FAT_4D = {
  id: 'lose_fat_4d', goalId: 'lose_fat', goalLabel: 'Lose Fat', daysPerWeek: 4,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    UPPER_DAY('Monday',   'Upper — strength'),
    LOWER_DAY('Tuesday',  'Lower — strength'),
    REST('Wednesday'),
    FULL_BODY_DAY('Thursday', 'Conditioning circuit'),
    RUN_EASY('Friday'),
    REST('Saturday'), REST('Sunday'),
  ],
};

// ── SCAFFOLDS — Run 5K / 10K ────────────────────────────────────────────────
const RUN_5K_3D = {
  id: 'run_5k_3d', goalId: 'run_5k', goalLabel: 'Run a 5K', daysPerWeek: 3,
  phaseTemplate: ['Base', 'Speed', 'Taper'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    REST('Tuesday'),
    RUN_INTERVALS('Wednesday'),
    REST('Thursday'),
    RUN_LONG('Friday'),
    REST('Saturday'), REST('Sunday'),
  ],
};

const RUN_5K_4D = {
  id: 'run_5k_4d', goalId: 'run_5k', goalLabel: 'Run a 5K', daysPerWeek: 4,
  phaseTemplate: ['Base', 'Speed', 'Taper'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    RUN_INTERVALS('Tuesday'),
    REST('Wednesday'),
    RUN_TEMPO('Thursday'),
    RUN_LONG('Saturday'),
    REST('Friday'), REST('Sunday'),
  ],
};

const RUN_10K_3D = {
  id: 'run_10k_3d', goalId: 'run_10k', goalLabel: 'Run a 10K', daysPerWeek: 3,
  phaseTemplate: ['Base', 'Threshold', 'Taper'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    REST('Tuesday'),
    RUN_TEMPO('Wednesday'),
    REST('Thursday'),
    RUN_LONG('Saturday'),
    REST('Friday'), REST('Sunday'),
  ],
};

const RUN_10K_4D = {
  id: 'run_10k_4d', goalId: 'run_10k', goalLabel: 'Run a 10K', daysPerWeek: 4,
  phaseTemplate: ['Base', 'Threshold', 'Taper'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    RUN_INTERVALS('Tuesday'),
    REST('Wednesday'),
    RUN_HILL('Thursday'),
    RUN_LONG('Saturday'),
    REST('Friday'), REST('Sunday'),
  ],
};

// ── SCAFFOLDS — CrossFit ────────────────────────────────────────────────────
const CROSSFIT_3D = {
  id: 'crossfit_3d', goalId: 'crossfit', goalLabel: 'Train CrossFit', daysPerWeek: 3,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    CROSSFIT_DAY('Monday',    'WOD — strength + metcon'),
    REST('Tuesday'),
    CROSSFIT_DAY('Wednesday', 'WOD — gymnastic'),
    REST('Thursday'),
    CROSSFIT_DAY('Friday',    'WOD — benchmark'),
    REST('Saturday'), REST('Sunday'),
  ],
};

const CROSSFIT_4D = {
  id: 'crossfit_4d', goalId: 'crossfit', goalLabel: 'Train CrossFit', daysPerWeek: 4,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    CROSSFIT_DAY('Monday',   'WOD — strength + metcon'),
    CROSSFIT_DAY('Tuesday',  'WOD — gymnastic'),
    REST('Wednesday'),
    CROSSFIT_DAY('Thursday', 'WOD — chipper'),
    {
      day: 'Friday', type: 'strength', focus: 'Accessory strength',
      slots: [
        { id: 'a1', pattern: P.SQUAT,           muscle: 'quads', compound: true, priority: 'secondary' },
        { id: 'a2', pattern: P.HINGE,           muscle: 'hamstrings', compound: true, priority: 'secondary' },
        { id: 'a3', pattern: P.HORIZONTAL_PUSH, muscle: 'chest', compound: true, priority: 'secondary' },
        { id: 'a4', pattern: P.VERTICAL_PULL,   muscle: 'back',  compound: true, priority: 'secondary' },
      ],
    },
    REST('Saturday'), REST('Sunday'),
  ],
};

// ── SCAFFOLDS — Hyrox ───────────────────────────────────────────────────────
const HYROX_3D = {
  id: 'hyrox_3d', goalId: 'hyrox', goalLabel: 'Train for Hyrox', daysPerWeek: 3,
  phaseTemplate: ['Base', 'Threshold', 'Race Pace'],
  weeklyPattern: [
    HYROX_DAY('Monday',     'Hyrox session — full sim'),
    REST('Tuesday'),
    RUN_LONG('Wednesday'),
    REST('Thursday'),
    HYROX_DAY('Friday',     'Hyrox session — compromised cardio'),
    REST('Saturday'), REST('Sunday'),
  ],
};

const HYROX_4D = {
  id: 'hyrox_4d', goalId: 'hyrox', goalLabel: 'Train for Hyrox', daysPerWeek: 4,
  phaseTemplate: ['Base', 'Threshold', 'Race Pace'],
  weeklyPattern: [
    HYROX_DAY('Monday',    'Hyrox session — stations'),
    RUN_TEMPO('Tuesday'),
    REST('Wednesday'),
    HYROX_DAY('Thursday',  'Hyrox session — half sim'),
    LOWER_DAY('Friday',    'Legs + core'),
    REST('Saturday'), REST('Sunday'),
  ],
};

// ── SCAFFOLDS — General Fitness ─────────────────────────────────────────────
const GENERAL_3D = {
  id: 'general_3d', goalId: 'general', goalLabel: 'General Fitness', daysPerWeek: 3,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    FULL_BODY_DAY('Monday'),
    REST('Tuesday'),
    FULL_BODY_DAY('Wednesday'),
    REST('Thursday'),
    FULL_BODY_DAY('Friday'),
    REST('Saturday'), REST('Sunday'),
  ],
};

const GENERAL_4D = {
  id: 'general_4d', goalId: 'general', goalLabel: 'General Fitness', daysPerWeek: 4,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    UPPER_DAY('Monday'),
    LOWER_DAY('Tuesday'),
    REST('Wednesday'),
    UPPER_DAY('Thursday'),
    LOWER_DAY('Friday'),
    REST('Saturday'), REST('Sunday'),
  ],
};

// ── SCAFFOLDS — Get Stronger 5/6 day ────────────────────────────────────────
const GET_STRONG_5D = {
  id: 'get_strong_5d', goalId: 'get_strong', goalLabel: 'Get Stronger', daysPerWeek: 5,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    SQUAT_DAY('Monday'),
    BENCH_DAY('Tuesday'),
    REST('Wednesday'),
    DEADLIFT_DAY('Thursday'),
    UPPER_DAY('Friday', 'Upper — volume accessory'),
    LOWER_DAY('Saturday', 'Lower — volume accessory'),
    REST('Sunday'),
  ],
};

const GET_STRONG_6D = {
  id: 'get_strong_6d', goalId: 'get_strong', goalLabel: 'Get Stronger', daysPerWeek: 6,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    SQUAT_DAY('Monday',    'Squat — heavy'),
    BENCH_DAY('Tuesday',   'Bench — heavy'),
    DEADLIFT_DAY('Wednesday', 'Deadlift — heavy'),
    SQUAT_DAY('Thursday',  'Squat — volume'),
    BENCH_DAY('Friday',    'Bench — volume'),
    UPPER_DAY('Saturday',  'Upper accessory'),
    REST('Sunday'),
  ],
};

// ── SCAFFOLDS — Lose Fat 5/6 day ────────────────────────────────────────────
const LOSE_FAT_5D = {
  id: 'lose_fat_5d', goalId: 'lose_fat', goalLabel: 'Lose Fat', daysPerWeek: 5,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    UPPER_DAY('Monday',   'Upper — strength'),
    LOWER_DAY('Tuesday',  'Lower — strength'),
    CONDITIONING_DAY('Wednesday'),
    RUN_EASY('Thursday'),
    FULL_BODY_DAY('Friday', 'Full body — circuits'),
    REST('Saturday'), REST('Sunday'),
  ],
};

const LOSE_FAT_6D = {
  id: 'lose_fat_6d', goalId: 'lose_fat', goalLabel: 'Lose Fat', daysPerWeek: 6,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    UPPER_DAY('Monday',   'Upper — strength'),
    LOWER_DAY('Tuesday',  'Lower — strength'),
    RUN_EASY('Wednesday'),
    CONDITIONING_DAY('Thursday'),
    FULL_BODY_DAY('Friday', 'Full body — circuits'),
    RUN_EASY('Saturday'),
    REST('Sunday'),
  ],
};

// ── SCAFFOLDS — Run 5K 5/6 day ──────────────────────────────────────────────
const RUN_5K_5D = {
  id: 'run_5k_5d', goalId: 'run_5k', goalLabel: 'Run a 5K', daysPerWeek: 5,
  phaseTemplate: ['Base', 'Speed', 'Taper'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    RUN_INTERVALS('Tuesday'),
    RUN_RECOVERY('Wednesday'),
    RUN_TEMPO('Thursday'),
    REST('Friday'),
    RUN_LONG('Saturday'),
    REST('Sunday'),
  ],
};

const RUN_5K_6D = {
  id: 'run_5k_6d', goalId: 'run_5k', goalLabel: 'Run a 5K', daysPerWeek: 6,
  phaseTemplate: ['Base', 'Speed', 'Taper'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    RUN_INTERVALS('Tuesday'),
    RUN_RECOVERY('Wednesday'),
    RUN_TEMPO('Thursday'),
    RUN_HILL('Friday'),
    RUN_LONG('Saturday'),
    REST('Sunday'),
  ],
};

// ── SCAFFOLDS — Run 10K 5/6 day ─────────────────────────────────────────────
const RUN_10K_5D = {
  id: 'run_10k_5d', goalId: 'run_10k', goalLabel: 'Run a 10K', daysPerWeek: 5,
  phaseTemplate: ['Base', 'Threshold', 'Taper'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    RUN_INTERVALS('Tuesday'),
    RUN_RECOVERY('Wednesday'),
    RUN_TEMPO('Thursday'),
    REST('Friday'),
    RUN_LONG('Saturday', '10-14 km'),
    REST('Sunday'),
  ],
};

const RUN_10K_6D = {
  id: 'run_10k_6d', goalId: 'run_10k', goalLabel: 'Run a 10K', daysPerWeek: 6,
  phaseTemplate: ['Base', 'Threshold', 'Taper'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    RUN_INTERVALS('Tuesday'),
    RUN_RECOVERY('Wednesday'),
    RUN_TEMPO('Thursday'),
    RUN_HILL('Friday'),
    RUN_LONG('Saturday', '10-14 km'),
    REST('Sunday'),
  ],
};

// ── SCAFFOLDS — CrossFit 5/6 day ────────────────────────────────────────────
const CROSSFIT_5D = {
  id: 'crossfit_5d', goalId: 'crossfit', goalLabel: 'Train CrossFit', daysPerWeek: 5,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    CROSSFIT_DAY('Monday',   'WOD — strength + metcon'),
    CROSSFIT_DAY('Tuesday',  'WOD — gymnastic'),
    REST('Wednesday'),
    CROSSFIT_DAY('Thursday', 'WOD — chipper'),
    CROSSFIT_DAY('Friday',   'WOD — benchmark'),
    {
      day: 'Saturday', type: 'strength', focus: 'Accessory strength',
      slots: [
        { id: 'a1', pattern: P.SQUAT,           muscle: 'quads',      compound: true, priority: 'secondary' },
        { id: 'a2', pattern: P.HINGE,           muscle: 'hamstrings', compound: true, priority: 'secondary' },
        { id: 'a3', pattern: P.HORIZONTAL_PUSH, muscle: 'chest',      compound: true, priority: 'secondary' },
        { id: 'a4', pattern: P.VERTICAL_PULL,   muscle: 'back',       compound: true, priority: 'secondary' },
      ],
    },
    REST('Sunday'),
  ],
};

const CROSSFIT_6D = {
  id: 'crossfit_6d', goalId: 'crossfit', goalLabel: 'Train CrossFit', daysPerWeek: 6,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    CROSSFIT_DAY('Monday',    'WOD — strength + metcon'),
    CROSSFIT_DAY('Tuesday',   'WOD — gymnastic'),
    CROSSFIT_DAY('Wednesday', 'WOD — chipper'),
    CROSSFIT_DAY('Thursday',  'WOD — benchmark'),
    CROSSFIT_DAY('Friday',    'WOD — EMOM / intervals'),
    {
      day: 'Saturday', type: 'strength', focus: 'Accessory strength',
      slots: [
        { id: 'a1', pattern: P.SQUAT,           muscle: 'quads',      compound: true, priority: 'secondary' },
        { id: 'a2', pattern: P.HINGE,           muscle: 'hamstrings', compound: true, priority: 'secondary' },
        { id: 'a3', pattern: P.HORIZONTAL_PUSH, muscle: 'chest',      compound: true, priority: 'secondary' },
        { id: 'a4', pattern: P.VERTICAL_PULL,   muscle: 'back',       compound: true, priority: 'secondary' },
      ],
    },
    REST('Sunday'),
  ],
};

// ── SCAFFOLDS — Hyrox 5/6 day ───────────────────────────────────────────────
const HYROX_5D = {
  id: 'hyrox_5d', goalId: 'hyrox', goalLabel: 'Train for Hyrox', daysPerWeek: 5,
  phaseTemplate: ['Base', 'Threshold', 'Race Pace'],
  weeklyPattern: [
    HYROX_DAY('Monday',   'Hyrox session — stations'),
    RUN_TEMPO('Tuesday'),
    REST('Wednesday'),
    HYROX_DAY('Thursday', 'Hyrox session — compromised cardio'),
    LOWER_DAY('Friday',   'Legs + core'),
    RUN_LONG('Saturday', '12-16 km'),
    REST('Sunday'),
  ],
};

const HYROX_6D = {
  id: 'hyrox_6d', goalId: 'hyrox', goalLabel: 'Train for Hyrox', daysPerWeek: 6,
  phaseTemplate: ['Base', 'Threshold', 'Race Pace'],
  weeklyPattern: [
    HYROX_DAY('Monday',    'Hyrox session — stations'),
    RUN_TEMPO('Tuesday'),
    HYROX_DAY('Wednesday', 'Hyrox session — compromised cardio'),
    LOWER_DAY('Thursday',  'Legs + core'),
    RUN_INTERVALS('Friday'),
    HYROX_DAY('Saturday',  'Hyrox session — full sim'),
    REST('Sunday'),
  ],
};

// ── SCAFFOLDS — General Fitness 5/6 day ─────────────────────────────────────
const GENERAL_5D = {
  id: 'general_5d', goalId: 'general', goalLabel: 'General Fitness', daysPerWeek: 5,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    UPPER_DAY('Monday'),
    LOWER_DAY('Tuesday'),
    RUN_EASY('Wednesday'),
    UPPER_DAY('Thursday'),
    LOWER_DAY('Friday'),
    REST('Saturday'), REST('Sunday'),
  ],
};

const GENERAL_6D = {
  id: 'general_6d', goalId: 'general', goalLabel: 'General Fitness', daysPerWeek: 6,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    PUSH_DAY('Monday'),
    PULL_DAY('Tuesday'),
    LEG_DAY('Wednesday'),
    UPPER_DAY('Thursday'),
    LOWER_DAY('Friday'),
    FULL_BODY_DAY('Saturday', 'Full body + conditioning'),
    REST('Sunday'),
  ],
};

// ── SCAFFOLDS — Run Half Marathon ───────────────────────────────────────────
// Four-phase periodisation: Base → Build → Peak → Taper. Long runs build to
// race distance, then taper down the final phase.
const RUN_HALF_3D = {
  id: 'run_half_3d', goalId: 'run_half', goalLabel: 'Run a Half Marathon', daysPerWeek: 3,
  phaseTemplate: ['Base', 'Build', 'Peak', 'Taper'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    REST('Tuesday'),
    RUN_TEMPO('Wednesday'),
    REST('Thursday'),
    RUN_LONG('Saturday', '14-20 km'),
    REST('Friday'), REST('Sunday'),
  ],
};

const RUN_HALF_4D = {
  id: 'run_half_4d', goalId: 'run_half', goalLabel: 'Run a Half Marathon', daysPerWeek: 4,
  phaseTemplate: ['Base', 'Build', 'Peak', 'Taper'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    RUN_INTERVALS('Tuesday'),
    REST('Wednesday'),
    RUN_TEMPO('Thursday'),
    RUN_LONG('Saturday', '14-20 km'),
    REST('Friday'), REST('Sunday'),
  ],
};

const RUN_HALF_5D = {
  id: 'run_half_5d', goalId: 'run_half', goalLabel: 'Run a Half Marathon', daysPerWeek: 5,
  phaseTemplate: ['Base', 'Build', 'Peak', 'Taper'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    RUN_INTERVALS('Tuesday'),
    RUN_RECOVERY('Wednesday'),
    RUN_TEMPO('Thursday'),
    REST('Friday'),
    RUN_LONG('Saturday', '14-20 km'),
    REST('Sunday'),
  ],
};

const RUN_HALF_6D = {
  id: 'run_half_6d', goalId: 'run_half', goalLabel: 'Run a Half Marathon', daysPerWeek: 6,
  phaseTemplate: ['Base', 'Build', 'Peak', 'Taper'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    RUN_INTERVALS('Tuesday'),
    RUN_RECOVERY('Wednesday'),
    RUN_TEMPO('Thursday'),
    RUN_HILL('Friday'),
    RUN_LONG('Saturday', '14-20 km'),
    REST('Sunday'),
  ],
};

// ── SCAFFOLDS — Run Marathon ────────────────────────────────────────────────
// Same four-phase arc, but long runs build toward marathon distance.
const RUN_MARATHON_3D = {
  id: 'run_marathon_3d', goalId: 'run_marathon', goalLabel: 'Run a Marathon', daysPerWeek: 3,
  phaseTemplate: ['Base', 'Build', 'Peak', 'Taper'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    REST('Tuesday'),
    RUN_TEMPO('Wednesday'),
    REST('Thursday'),
    RUN_LONG('Saturday', '20-32 km'),
    REST('Friday'), REST('Sunday'),
  ],
};

const RUN_MARATHON_4D = {
  id: 'run_marathon_4d', goalId: 'run_marathon', goalLabel: 'Run a Marathon', daysPerWeek: 4,
  phaseTemplate: ['Base', 'Build', 'Peak', 'Taper'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    RUN_TEMPO('Tuesday'),
    REST('Wednesday'),
    RUN_EASY('Thursday'),
    RUN_LONG('Saturday', '20-32 km'),
    REST('Friday'), REST('Sunday'),
  ],
};

const RUN_MARATHON_5D = {
  id: 'run_marathon_5d', goalId: 'run_marathon', goalLabel: 'Run a Marathon', daysPerWeek: 5,
  phaseTemplate: ['Base', 'Build', 'Peak', 'Taper'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    RUN_INTERVALS('Tuesday'),
    RUN_RECOVERY('Wednesday'),
    RUN_TEMPO('Thursday'),
    REST('Friday'),
    RUN_LONG('Saturday', '20-32 km'),
    REST('Sunday'),
  ],
};

const RUN_MARATHON_6D = {
  id: 'run_marathon_6d', goalId: 'run_marathon', goalLabel: 'Run a Marathon', daysPerWeek: 6,
  phaseTemplate: ['Base', 'Build', 'Peak', 'Taper'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    RUN_INTERVALS('Tuesday'),
    RUN_RECOVERY('Wednesday'),
    RUN_TEMPO('Thursday'),
    RUN_EASY('Friday'),
    RUN_LONG('Saturday', '20-32 km'),
    REST('Sunday'),
  ],
};

// ── SCAFFOLDS — Improve Endurance ───────────────────────────────────────────
// Running-led, with a full-body cross-training day to support the aerobic work.
const ENDURANCE_3D = {
  id: 'endurance_3d', goalId: 'endurance', goalLabel: 'Improve Endurance', daysPerWeek: 3,
  phaseTemplate: ['Base', 'Build', 'Peak'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    REST('Tuesday'),
    RUN_TEMPO('Wednesday'),
    REST('Thursday'),
    RUN_LONG('Saturday', '10-16 km'),
    REST('Friday'), REST('Sunday'),
  ],
};

const ENDURANCE_4D = {
  id: 'endurance_4d', goalId: 'endurance', goalLabel: 'Improve Endurance', daysPerWeek: 4,
  phaseTemplate: ['Base', 'Build', 'Peak'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    RUN_INTERVALS('Tuesday'),
    REST('Wednesday'),
    FULL_BODY_DAY('Thursday', 'Cross-training — full body'),
    RUN_LONG('Saturday', '10-16 km'),
    REST('Friday'), REST('Sunday'),
  ],
};

const ENDURANCE_5D = {
  id: 'endurance_5d', goalId: 'endurance', goalLabel: 'Improve Endurance', daysPerWeek: 5,
  phaseTemplate: ['Base', 'Build', 'Peak'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    RUN_INTERVALS('Tuesday'),
    RUN_TEMPO('Wednesday'),
    FULL_BODY_DAY('Thursday', 'Cross-training — full body'),
    RUN_LONG('Saturday', '10-16 km'),
    REST('Friday'), REST('Sunday'),
  ],
};

const ENDURANCE_6D = {
  id: 'endurance_6d', goalId: 'endurance', goalLabel: 'Improve Endurance', daysPerWeek: 6,
  phaseTemplate: ['Base', 'Build', 'Peak'],
  weeklyPattern: [
    RUN_EASY('Monday'),
    RUN_INTERVALS('Tuesday'),
    RUN_TEMPO('Wednesday'),
    FULL_BODY_DAY('Thursday', 'Cross-training — full body'),
    RUN_RECOVERY('Friday'),
    RUN_LONG('Saturday', '10-16 km'),
    REST('Sunday'),
  ],
};

// ── SCAFFOLDS — Athletic Performance ────────────────────────────────────────
// Power-focused strength + speed intervals + conditioning WODs.
const ATHLETIC_3D = {
  id: 'athletic_3d', goalId: 'athletic', goalLabel: 'Athletic Performance', daysPerWeek: 3,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    UPPER_DAY('Monday',  'Upper — power'),
    REST('Tuesday'),
    LOWER_DAY('Wednesday', 'Lower — power'),
    REST('Thursday'),
    CROSSFIT_DAY('Friday', 'Conditioning WOD'),
    REST('Saturday'), REST('Sunday'),
  ],
};

const ATHLETIC_4D = {
  id: 'athletic_4d', goalId: 'athletic', goalLabel: 'Athletic Performance', daysPerWeek: 4,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    UPPER_DAY('Monday',  'Upper — power'),
    LOWER_DAY('Tuesday', 'Lower — power'),
    REST('Wednesday'),
    RUN_INTERVALS('Thursday'),
    CROSSFIT_DAY('Friday', 'Conditioning WOD'),
    REST('Saturday'), REST('Sunday'),
  ],
};

const ATHLETIC_5D = {
  id: 'athletic_5d', goalId: 'athletic', goalLabel: 'Athletic Performance', daysPerWeek: 5,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    UPPER_DAY('Monday',  'Upper — power'),
    LOWER_DAY('Tuesday', 'Lower — power'),
    RUN_INTERVALS('Wednesday'),
    FULL_BODY_DAY('Thursday', 'Full body — explosive'),
    CROSSFIT_DAY('Friday', 'Conditioning WOD'),
    REST('Saturday'), REST('Sunday'),
  ],
};

const ATHLETIC_6D = {
  id: 'athletic_6d', goalId: 'athletic', goalLabel: 'Athletic Performance', daysPerWeek: 6,
  phaseTemplate: ['Foundation', 'Build', 'Peak'],
  weeklyPattern: [
    PUSH_DAY('Monday',   'Push — power'),
    PULL_DAY('Tuesday',  'Pull — power'),
    LEG_DAY('Wednesday', 'Legs — power'),
    RUN_INTERVALS('Thursday'),
    FULL_BODY_DAY('Friday', 'Full body — explosive'),
    CROSSFIT_DAY('Saturday', 'Conditioning WOD'),
    REST('Sunday'),
  ],
};

// ── Scaffold registry ────────────────────────────────────────────────────────
// Key = `${goalId}_${daysPerWeek}d`. The generator looks up by this key.
export const SCAFFOLDS = {
  'build_muscle_3d': BUILD_MUSCLE_3D,
  'build_muscle_4d': BUILD_MUSCLE_4D,
  'build_muscle_5d': BUILD_MUSCLE_5D,
  'build_muscle_6d': BUILD_MUSCLE_6D,
  'get_strong_3d':   GET_STRONG_3D,
  'get_strong_4d':   GET_STRONG_4D,
  'get_strong_5d':   GET_STRONG_5D,
  'get_strong_6d':   GET_STRONG_6D,
  'lose_fat_3d':     LOSE_FAT_3D,
  'lose_fat_4d':     LOSE_FAT_4D,
  'lose_fat_5d':     LOSE_FAT_5D,
  'lose_fat_6d':     LOSE_FAT_6D,
  'run_5k_3d':       RUN_5K_3D,
  'run_5k_4d':       RUN_5K_4D,
  'run_5k_5d':       RUN_5K_5D,
  'run_5k_6d':       RUN_5K_6D,
  'run_10k_3d':      RUN_10K_3D,
  'run_10k_4d':      RUN_10K_4D,
  'run_10k_5d':      RUN_10K_5D,
  'run_10k_6d':      RUN_10K_6D,
  'run_half_3d':     RUN_HALF_3D,
  'run_half_4d':     RUN_HALF_4D,
  'run_half_5d':     RUN_HALF_5D,
  'run_half_6d':     RUN_HALF_6D,
  'run_marathon_3d': RUN_MARATHON_3D,
  'run_marathon_4d': RUN_MARATHON_4D,
  'run_marathon_5d': RUN_MARATHON_5D,
  'run_marathon_6d': RUN_MARATHON_6D,
  'crossfit_3d':     CROSSFIT_3D,
  'crossfit_4d':     CROSSFIT_4D,
  'crossfit_5d':     CROSSFIT_5D,
  'crossfit_6d':     CROSSFIT_6D,
  'hyrox_3d':        HYROX_3D,
  'hyrox_4d':        HYROX_4D,
  'hyrox_5d':        HYROX_5D,
  'hyrox_6d':        HYROX_6D,
  'endurance_3d':    ENDURANCE_3D,
  'endurance_4d':    ENDURANCE_4D,
  'endurance_5d':    ENDURANCE_5D,
  'endurance_6d':    ENDURANCE_6D,
  'athletic_3d':     ATHLETIC_3D,
  'athletic_4d':     ATHLETIC_4D,
  'athletic_5d':     ATHLETIC_5D,
  'athletic_6d':     ATHLETIC_6D,
  'general_3d':      GENERAL_3D,
  'general_4d':      GENERAL_4D,
  'general_5d':      GENERAL_5D,
  'general_6d':      GENERAL_6D,
};

/**
 * Look up the scaffold matching a goal + days/week. Returns null if no
 * scaffold exists yet for that combo (caller should fall back).
 */
export function findScaffold(goalId, daysPerWeek) {
  return SCAFFOLDS[`${goalId}_${daysPerWeek}d`] || null;
}

/**
 * Does this goal have at least one scaffold (any days-per-week)? PlanScreen
 * uses this to hide goals from the picker that can't actually be generated,
 * so the user never hits a dead end.
 */
export function goalHasAnyScaffold(goalId) {
  return Object.keys(SCAFFOLDS).some(k => k.startsWith(`${goalId}_`));
}

/**
 * Which days-per-week options are available for a given goal. PlanScreen uses
 * this to grey out / hide day choices with no scaffold.
 */
export function availableDaysForGoal(goalId) {
  return [3, 4, 5, 6].filter(d => !!SCAFFOLDS[`${goalId}_${d}d`]);
}

/**
 * Stretch the phase template across the user's chosen total duration.
 * Returns an array of phases with concrete startWeek / endWeek / loading.
 *
 * For 12 weeks + 3 phases → 4 weeks each.
 * For 6 weeks  + 3 phases → 2 weeks each.
 * For 16 weeks + 3 phases → 5/6/5 (middle phase gets the extra).
 * For 24+ weeks → inserts a Deload week between each hard phase.
 */
export function planPhases(phaseTemplate, totalWeeks) {
  const n = phaseTemplate.length;
  const base = Math.floor(totalWeeks / n);
  const extra = totalWeeks - base * n;

  // Build basic phase durations (give extra weeks to the middle phase first,
  // then outward). For 3 phases + 2 extra: [+0, +2, +0] → [4, 6, 4].
  const lengths = new Array(n).fill(base);
  let cursor = Math.floor(n / 2);
  for (let i = 0; i < extra; i++) {
    lengths[cursor]++;
    // Spiral outward: middle, middle+1, middle-1, middle+2, ...
    const step = i + 1;
    cursor = Math.floor(n / 2) + (step % 2 === 1 ? Math.ceil(step / 2) : -Math.ceil(step / 2));
    if (cursor < 0 || cursor >= n) cursor = Math.floor(n / 2);
  }

  // For long plans (16+ weeks), insert a 1-week deload between each hard phase.
  const includeDeload = totalWeeks >= 16;

  const phases = [];
  let week = 1;
  for (let i = 0; i < n; i++) {
    const phaseName = phaseTemplate[i];
    const len = lengths[i];
    phases.push({
      name: phaseName,
      startWeek: week,
      endWeek: week + len - 1,
      loading: PHASE_LOADING[phaseName] || PHASE_LOADING.Build,
      focus: PHASE_LOADING[phaseName]?.focus || '',
    });
    week += len;

    if (includeDeload && i < n - 1) {
      phases.push({
        name: 'Deload',
        startWeek: week,
        endWeek: week,
        loading: PHASE_LOADING.Deload,
        focus: PHASE_LOADING.Deload.focus,
      });
      week++;
    }
  }

  // If deload insertion overshot or undershot the requested duration, trim
  // or extend the final phase to land exactly on totalWeeks.
  const last = phases[phases.length - 1];
  if (last.endWeek > totalWeeks) {
    last.endWeek = totalWeeks;
  } else if (last.endWeek < totalWeeks) {
    last.endWeek = totalWeeks;
  }

  return phases;
}
