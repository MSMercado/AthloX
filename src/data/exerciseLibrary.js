// v1.3.0 — curated exercise library that powers the hybrid plan generator.
//
// Each entry is tagged so the generator can filter to what the user can actually
// do given their equipment + level, then pick the right movement for each slot
// in a scaffold (e.g. "compound horizontal push for chest").
//
// Shape:
//   {
//     name:          'Bench Press',
//     muscle:        'chest',            // primary muscle group worked
//     pattern:       'horizontal-push',  // movement pattern (see PATTERNS below)
//     equipment:     ['barbell', 'bench'], // ALL items required to do it
//     difficulty:    'intermediate',     // beginner | intermediate | advanced
//     compound:      true,               // true = multi-joint, false = isolation
//     tutorialKey:   'bench_press',      // matches src/data/exerciseTutorials.js
//   }
//
// Equipment vocabulary (must match what the signup wizard asks):
//   'barbell', 'dumbbell', 'kettlebell', 'bench', 'pullup_bar', 'cable',
//   'machine', 'bands', 'bodyweight'
//
// 'bodyweight' is implicitly always available — never list it as required.

export const PATTERNS = {
  HORIZONTAL_PUSH: 'horizontal-push',
  INCLINE_PUSH:    'incline-push',
  VERTICAL_PUSH:   'vertical-push',
  HORIZONTAL_PULL: 'horizontal-pull',
  VERTICAL_PULL:   'vertical-pull',
  SQUAT:           'squat',
  HINGE:           'hinge',
  LUNGE:           'lunge',
  ISOLATION_CHEST: 'isolation-chest',
  ISOLATION_BACK:  'isolation-back',
  ISOLATION_DELT:  'isolation-delt',
  ISOLATION_BICEP: 'isolation-bicep',
  ISOLATION_TRI:   'isolation-tricep',
  ISOLATION_LEG:   'isolation-leg',
  CALF:            'calf',
  CORE_FLEX:       'core-flex',
  CORE_ANTI:       'core-anti',
};

export const EXERCISES = [
  // ── PUSH (chest, shoulders, triceps) ─────────────────────────────────────
  { name: 'Bench Press',              muscle: 'chest',    pattern: PATTERNS.HORIZONTAL_PUSH, equipment: ['barbell', 'bench'],    difficulty: 'intermediate', compound: true,  tutorialKey: 'bench_press' },
  { name: 'Dumbbell Bench Press',     muscle: 'chest',    pattern: PATTERNS.HORIZONTAL_PUSH, equipment: ['dumbbell', 'bench'],   difficulty: 'beginner',     compound: true,  tutorialKey: 'db_bench_press' },
  { name: 'Push-up',                  muscle: 'chest',    pattern: PATTERNS.HORIZONTAL_PUSH, equipment: [],                      difficulty: 'beginner',     compound: true,  tutorialKey: 'pushup' },
  { name: 'Incline Bench Press',      muscle: 'chest',    pattern: PATTERNS.INCLINE_PUSH,    equipment: ['barbell', 'bench'],    difficulty: 'intermediate', compound: true,  tutorialKey: 'incline_bench' },
  { name: 'Incline Dumbbell Press',   muscle: 'chest',    pattern: PATTERNS.INCLINE_PUSH,    equipment: ['dumbbell', 'bench'],   difficulty: 'beginner',     compound: true,  tutorialKey: 'incline_db_press' },
  { name: 'Dips',                     muscle: 'chest',    pattern: PATTERNS.VERTICAL_PUSH,   equipment: [],                      difficulty: 'intermediate', compound: true,  tutorialKey: 'dips' },
  { name: 'Cable Fly',                muscle: 'chest',    pattern: PATTERNS.ISOLATION_CHEST, equipment: ['cable'],               difficulty: 'beginner',     compound: false, tutorialKey: 'cable_fly' },
  { name: 'Dumbbell Fly',             muscle: 'chest',    pattern: PATTERNS.ISOLATION_CHEST, equipment: ['dumbbell', 'bench'],   difficulty: 'beginner',     compound: false, tutorialKey: 'db_fly' },

  { name: 'Overhead Press',           muscle: 'shoulders',pattern: PATTERNS.VERTICAL_PUSH,   equipment: ['barbell'],             difficulty: 'intermediate', compound: true,  tutorialKey: 'ohp' },
  { name: 'Dumbbell Shoulder Press',  muscle: 'shoulders',pattern: PATTERNS.VERTICAL_PUSH,   equipment: ['dumbbell'],            difficulty: 'beginner',     compound: true,  tutorialKey: 'db_shoulder_press' },
  { name: 'Lateral Raise',            muscle: 'shoulders',pattern: PATTERNS.ISOLATION_DELT,  equipment: ['dumbbell'],            difficulty: 'beginner',     compound: false, tutorialKey: 'lateral_raise' },
  { name: 'Front Raise',              muscle: 'shoulders',pattern: PATTERNS.ISOLATION_DELT,  equipment: ['dumbbell'],            difficulty: 'beginner',     compound: false, tutorialKey: 'front_raise' },
  { name: 'Face Pull',                muscle: 'shoulders',pattern: PATTERNS.ISOLATION_DELT,  equipment: ['cable'],               difficulty: 'beginner',     compound: false, tutorialKey: 'face_pull' },

  { name: 'Triceps Pushdown',         muscle: 'triceps',  pattern: PATTERNS.ISOLATION_TRI,   equipment: ['cable'],               difficulty: 'beginner',     compound: false, tutorialKey: 'tri_pushdown' },
  { name: 'Overhead Triceps Ext.',    muscle: 'triceps',  pattern: PATTERNS.ISOLATION_TRI,   equipment: ['dumbbell'],            difficulty: 'beginner',     compound: false, tutorialKey: 'tri_overhead' },
  { name: 'Close-Grip Bench Press',   muscle: 'triceps',  pattern: PATTERNS.ISOLATION_TRI,   equipment: ['barbell', 'bench'],    difficulty: 'intermediate', compound: false, tutorialKey: 'cgbp' },

  // ── PULL (back, biceps) ──────────────────────────────────────────────────
  { name: 'Pull-up',                  muscle: 'back',     pattern: PATTERNS.VERTICAL_PULL,   equipment: ['pullup_bar'],          difficulty: 'advanced',     compound: true,  tutorialKey: 'pullup' },
  { name: 'Chin-up',                  muscle: 'back',     pattern: PATTERNS.VERTICAL_PULL,   equipment: ['pullup_bar'],          difficulty: 'intermediate', compound: true,  tutorialKey: 'chinup' },
  { name: 'Lat Pulldown',             muscle: 'back',     pattern: PATTERNS.VERTICAL_PULL,   equipment: ['cable'],               difficulty: 'beginner',     compound: true,  tutorialKey: 'lat_pulldown' },
  { name: 'Barbell Row',              muscle: 'back',     pattern: PATTERNS.HORIZONTAL_PULL, equipment: ['barbell'],             difficulty: 'intermediate', compound: true,  tutorialKey: 'barbell_row' },
  { name: 'Dumbbell Row',             muscle: 'back',     pattern: PATTERNS.HORIZONTAL_PULL, equipment: ['dumbbell', 'bench'],   difficulty: 'beginner',     compound: true,  tutorialKey: 'db_row' },
  { name: 'Seated Cable Row',         muscle: 'back',     pattern: PATTERNS.HORIZONTAL_PULL, equipment: ['cable'],               difficulty: 'beginner',     compound: true,  tutorialKey: 'cable_row' },
  { name: 'Inverted Row',             muscle: 'back',     pattern: PATTERNS.HORIZONTAL_PULL, equipment: [],                      difficulty: 'beginner',     compound: true,  tutorialKey: 'inverted_row' },

  { name: 'Barbell Curl',             muscle: 'biceps',   pattern: PATTERNS.ISOLATION_BICEP, equipment: ['barbell'],             difficulty: 'beginner',     compound: false, tutorialKey: 'barbell_curl' },
  { name: 'Dumbbell Curl',            muscle: 'biceps',   pattern: PATTERNS.ISOLATION_BICEP, equipment: ['dumbbell'],            difficulty: 'beginner',     compound: false, tutorialKey: 'db_curl' },
  { name: 'Hammer Curl',              muscle: 'biceps',   pattern: PATTERNS.ISOLATION_BICEP, equipment: ['dumbbell'],            difficulty: 'beginner',     compound: false, tutorialKey: 'hammer_curl' },

  // ── LEGS (quads, hamstrings, glutes, calves) ──────────────────────────────
  { name: 'Back Squat',               muscle: 'quads',    pattern: PATTERNS.SQUAT,           equipment: ['barbell'],             difficulty: 'intermediate', compound: true,  tutorialKey: 'back_squat' },
  { name: 'Front Squat',              muscle: 'quads',    pattern: PATTERNS.SQUAT,           equipment: ['barbell'],             difficulty: 'intermediate', compound: true,  tutorialKey: 'front_squat' },
  { name: 'Goblet Squat',             muscle: 'quads',    pattern: PATTERNS.SQUAT,           equipment: ['dumbbell'],            difficulty: 'beginner',     compound: true,  tutorialKey: 'goblet_squat' },
  { name: 'Bodyweight Squat',         muscle: 'quads',    pattern: PATTERNS.SQUAT,           equipment: [],                      difficulty: 'beginner',     compound: true,  tutorialKey: 'bw_squat' },
  { name: 'Leg Press',                muscle: 'quads',    pattern: PATTERNS.SQUAT,           equipment: ['machine'],             difficulty: 'beginner',     compound: true,  tutorialKey: 'leg_press' },
  { name: 'Bulgarian Split Squat',    muscle: 'quads',    pattern: PATTERNS.LUNGE,           equipment: ['dumbbell'],            difficulty: 'intermediate', compound: true,  tutorialKey: 'bss' },
  { name: 'Walking Lunge',            muscle: 'quads',    pattern: PATTERNS.LUNGE,           equipment: [],                      difficulty: 'beginner',     compound: true,  tutorialKey: 'walking_lunge' },

  { name: 'Deadlift',                 muscle: 'hamstrings',pattern: PATTERNS.HINGE,          equipment: ['barbell'],             difficulty: 'intermediate', compound: true,  tutorialKey: 'deadlift' },
  { name: 'Romanian Deadlift',        muscle: 'hamstrings',pattern: PATTERNS.HINGE,          equipment: ['barbell'],             difficulty: 'intermediate', compound: true,  tutorialKey: 'rdl' },
  { name: 'Dumbbell RDL',             muscle: 'hamstrings',pattern: PATTERNS.HINGE,          equipment: ['dumbbell'],            difficulty: 'beginner',     compound: true,  tutorialKey: 'db_rdl' },
  { name: 'Hip Thrust',               muscle: 'glutes',    pattern: PATTERNS.HINGE,          equipment: ['barbell', 'bench'],    difficulty: 'intermediate', compound: true,  tutorialKey: 'hip_thrust' },
  { name: 'Glute Bridge',             muscle: 'glutes',    pattern: PATTERNS.HINGE,          equipment: [],                      difficulty: 'beginner',     compound: true,  tutorialKey: 'glute_bridge' },

  { name: 'Leg Curl',                 muscle: 'hamstrings',pattern: PATTERNS.ISOLATION_LEG,  equipment: ['machine'],             difficulty: 'beginner',     compound: false, tutorialKey: 'leg_curl' },
  { name: 'Leg Extension',            muscle: 'quads',     pattern: PATTERNS.ISOLATION_LEG,  equipment: ['machine'],             difficulty: 'beginner',     compound: false, tutorialKey: 'leg_extension' },
  { name: 'Standing Calf Raise',      muscle: 'calves',    pattern: PATTERNS.CALF,           equipment: [],                      difficulty: 'beginner',     compound: false, tutorialKey: 'calf_raise' },
  { name: 'Dumbbell Calf Raise',      muscle: 'calves',    pattern: PATTERNS.CALF,           equipment: ['dumbbell'],            difficulty: 'beginner',     compound: false, tutorialKey: 'db_calf_raise' },

  // ── CORE ─────────────────────────────────────────────────────────────────
  { name: 'Plank',                    muscle: 'core',     pattern: PATTERNS.CORE_ANTI,       equipment: [],                      difficulty: 'beginner',     compound: false, tutorialKey: 'plank' },
  { name: 'Side Plank',               muscle: 'core',     pattern: PATTERNS.CORE_ANTI,       equipment: [],                      difficulty: 'beginner',     compound: false, tutorialKey: 'side_plank' },
  { name: 'Hanging Leg Raise',        muscle: 'core',     pattern: PATTERNS.CORE_FLEX,       equipment: ['pullup_bar'],          difficulty: 'intermediate', compound: false, tutorialKey: 'hanging_leg_raise' },
  { name: 'Cable Crunch',             muscle: 'core',     pattern: PATTERNS.CORE_FLEX,       equipment: ['cable'],               difficulty: 'beginner',     compound: false, tutorialKey: 'cable_crunch' },
  { name: 'Dead Bug',                 muscle: 'core',     pattern: PATTERNS.CORE_ANTI,       equipment: [],                      difficulty: 'beginner',     compound: false, tutorialKey: 'dead_bug' },
  { name: 'Russian Twist',            muscle: 'core',     pattern: PATTERNS.CORE_FLEX,       equipment: [],                      difficulty: 'beginner',     compound: false, tutorialKey: 'russian_twist' },
  { name: 'Ab Wheel Rollout',         muscle: 'core',     pattern: PATTERNS.CORE_ANTI,       equipment: ['ab_wheel'],            difficulty: 'advanced',     compound: false, tutorialKey: 'ab_wheel' },
  { name: 'Bicycle Crunch',           muscle: 'core',     pattern: PATTERNS.CORE_FLEX,       equipment: [],                      difficulty: 'beginner',     compound: false, tutorialKey: 'bicycle_crunch' },

  // ── EXTRA push / pull / leg variations for 5-6 day plans ─────────────────
  { name: 'Arnold Press',             muscle: 'shoulders',pattern: PATTERNS.VERTICAL_PUSH,   equipment: ['dumbbell'],            difficulty: 'intermediate', compound: true,  tutorialKey: 'arnold_press' },
  { name: 'Landmine Press',           muscle: 'shoulders',pattern: PATTERNS.INCLINE_PUSH,    equipment: ['barbell'],             difficulty: 'intermediate', compound: true,  tutorialKey: 'landmine_press' },
  { name: 'Decline Bench Press',      muscle: 'chest',    pattern: PATTERNS.HORIZONTAL_PUSH, equipment: ['barbell', 'bench'],    difficulty: 'intermediate', compound: true,  tutorialKey: 'decline_bench' },
  { name: 'Pec Deck',                 muscle: 'chest',    pattern: PATTERNS.ISOLATION_CHEST, equipment: ['machine'],             difficulty: 'beginner',     compound: false, tutorialKey: 'pec_deck' },
  { name: 'Skull Crusher',            muscle: 'triceps',  pattern: PATTERNS.ISOLATION_TRI,   equipment: ['barbell', 'bench'],    difficulty: 'intermediate', compound: false, tutorialKey: 'skull_crusher' },
  { name: 'Rope Pushdown',            muscle: 'triceps',  pattern: PATTERNS.ISOLATION_TRI,   equipment: ['cable'],               difficulty: 'beginner',     compound: false, tutorialKey: 'rope_pushdown' },

  { name: 'T-Bar Row',                muscle: 'back',     pattern: PATTERNS.HORIZONTAL_PULL, equipment: ['barbell'],             difficulty: 'intermediate', compound: true,  tutorialKey: 't_bar_row' },
  { name: 'Meadows Row',              muscle: 'back',     pattern: PATTERNS.HORIZONTAL_PULL, equipment: ['barbell'],             difficulty: 'advanced',     compound: true,  tutorialKey: 'meadows_row' },
  { name: 'Preacher Curl',            muscle: 'biceps',   pattern: PATTERNS.ISOLATION_BICEP, equipment: ['dumbbell', 'bench'],   difficulty: 'beginner',     compound: false, tutorialKey: 'preacher_curl' },
  { name: 'Cable Curl',               muscle: 'biceps',   pattern: PATTERNS.ISOLATION_BICEP, equipment: ['cable'],               difficulty: 'beginner',     compound: false, tutorialKey: 'cable_curl' },

  { name: 'Hack Squat',               muscle: 'quads',    pattern: PATTERNS.SQUAT,           equipment: ['machine'],             difficulty: 'intermediate', compound: true,  tutorialKey: 'hack_squat' },
  { name: 'Pause Squat',              muscle: 'quads',    pattern: PATTERNS.SQUAT,           equipment: ['barbell'],             difficulty: 'advanced',     compound: true,  tutorialKey: 'pause_squat' },
  { name: 'Reverse Lunge',            muscle: 'quads',    pattern: PATTERNS.LUNGE,           equipment: ['dumbbell'],            difficulty: 'beginner',     compound: true,  tutorialKey: 'reverse_lunge' },
  { name: 'Step-up',                  muscle: 'quads',    pattern: PATTERNS.LUNGE,           equipment: ['dumbbell', 'bench'],   difficulty: 'beginner',     compound: true,  tutorialKey: 'step_up' },
  { name: 'Sumo Deadlift',            muscle: 'hamstrings',pattern: PATTERNS.HINGE,          equipment: ['barbell'],             difficulty: 'intermediate', compound: true,  tutorialKey: 'sumo_deadlift' },
  { name: 'Good Morning',             muscle: 'hamstrings',pattern: PATTERNS.HINGE,          equipment: ['barbell'],             difficulty: 'intermediate', compound: true,  tutorialKey: 'good_morning' },
  { name: 'Single-Leg RDL',           muscle: 'hamstrings',pattern: PATTERNS.HINGE,          equipment: ['dumbbell'],            difficulty: 'intermediate', compound: true,  tutorialKey: 'single_leg_rdl' },
  { name: 'Kettlebell Swing',         muscle: 'hamstrings',pattern: PATTERNS.HINGE,          equipment: ['kettlebell'],          difficulty: 'beginner',     compound: true,  tutorialKey: 'kb_swing' },

  // ── Conditioning (used by Lose Fat + General scaffolds) ──────────────────
  { name: 'Burpee',                   muscle: 'full',     pattern: PATTERNS.CORE_FLEX,       equipment: [],                      difficulty: 'intermediate', compound: true,  tutorialKey: 'burpee' },
  { name: 'Mountain Climber',         muscle: 'full',     pattern: PATTERNS.CORE_FLEX,       equipment: [],                      difficulty: 'beginner',     compound: true,  tutorialKey: 'mountain_climber' },
  { name: 'Jumping Jack',             muscle: 'full',     pattern: PATTERNS.CORE_FLEX,       equipment: [],                      difficulty: 'beginner',     compound: true,  tutorialKey: 'jumping_jack' },
  { name: 'Box Jump',                 muscle: 'quads',    pattern: PATTERNS.SQUAT,           equipment: ['box'],                 difficulty: 'intermediate', compound: true,  tutorialKey: 'box_jump' },
];

/**
 * Filter the library to exercises the user can actually do given their equipment.
 * Bodyweight (empty equipment array) is always allowed.
 */
export function filterByEquipment(userEquipment = []) {
  const have = new Set(userEquipment.map(e => e.toLowerCase()));
  return EXERCISES.filter(ex =>
    ex.equipment.every(req => have.has(req.toLowerCase()))
  );
}

/**
 * Filter to exercises matching the requested movement pattern(s). Pass either a
 * single pattern string or an array to allow any of several.
 */
export function filterByPattern(exercises, patternOrPatterns) {
  const patterns = Array.isArray(patternOrPatterns) ? patternOrPatterns : [patternOrPatterns];
  const set = new Set(patterns);
  return exercises.filter(ex => set.has(ex.pattern));
}

/**
 * Filter to exercises matching the user's difficulty. A user of "intermediate"
 * level can do beginner or intermediate; an "advanced" user can do anything.
 */
export function filterByDifficulty(exercises, userLevel) {
  const level = (userLevel || 'beginner').toLowerCase();
  const allowed = new Set();
  if (level === 'beginner') {
    allowed.add('beginner');
  } else if (level === 'intermediate') {
    allowed.add('beginner');
    allowed.add('intermediate');
  } else {
    allowed.add('beginner');
    allowed.add('intermediate');
    allowed.add('advanced');
  }
  return exercises.filter(ex => allowed.has(ex.difficulty));
}
