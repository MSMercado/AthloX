// v1.3.0 — curated WOD (Workout of the Day) library for CrossFit + Hyrox days.
//
// The plan generator picks from this library when the user's goal is
// "Train CrossFit" or "Train for Hyrox". Curated by hand (rather than
// LLM-generated) so the formats are standard, recognisable to athletes
// in those communities, and produced with zero token cost.
//
// Shape:
//   {
//     name:        'Cindy',
//     type:        'crossfit',         // 'crossfit' | 'hyrox'
//     format:      'AMRAP 20 min',     // displayed at the top of the day card
//     focus:       'Bodyweight AMRAP', // short label for the day
//     movements:   [                   // each is one exercise inside the round
//       { name: 'Pull-up',    reps: '5'  },
//       { name: 'Push-up',    reps: '10' },
//       { name: 'Air Squat',  reps: '15' },
//     ],
//     equipment:   ['pullup_bar'],     // required equipment (omit 'bodyweight')
//     difficulty:  'intermediate',     // beginner | intermediate | advanced
//     notes:       'Classic benchmark — score = total rounds + reps.',
//   }

export const CROSSFIT_WODS = [
  // ── BENCHMARK GIRLS / NAMED WODS ─────────────────────────────────────────
  {
    name: 'Cindy', type: 'crossfit',
    format: 'AMRAP 20 min',
    focus: 'Bodyweight AMRAP',
    movements: [
      { name: 'Pull-up',   reps: '5'  },
      { name: 'Push-up',   reps: '10' },
      { name: 'Air Squat', reps: '15' },
    ],
    equipment: ['pullup_bar'],
    difficulty: 'intermediate',
    notes: 'Score = total rounds + reps. Classic CrossFit benchmark.',
  },
  {
    name: 'Mary', type: 'crossfit',
    format: 'AMRAP 20 min',
    focus: 'Gymnastic AMRAP',
    movements: [
      { name: 'Handstand Push-up', reps: '5'  },
      { name: 'Pistol Squat',      reps: '10 (alt)' },
      { name: 'Pull-up',           reps: '15' },
    ],
    equipment: ['pullup_bar'],
    difficulty: 'advanced',
    notes: 'Gymnastic-heavy. Scale HSPU to pike push-ups.',
  },
  {
    name: 'Angie', type: 'crossfit',
    format: 'For Time',
    focus: 'High-volume bodyweight',
    movements: [
      { name: 'Pull-up',   reps: '100' },
      { name: 'Push-up',   reps: '100' },
      { name: 'Sit-up',    reps: '100' },
      { name: 'Air Squat', reps: '100' },
    ],
    equipment: ['pullup_bar'],
    difficulty: 'intermediate',
    notes: 'Complete all reps of each exercise before moving to the next.',
  },
  {
    name: 'Helen', type: 'crossfit',
    format: '3 Rounds For Time',
    focus: 'Running + KB + pull-ups',
    movements: [
      { name: 'Run',           distance: '400 m' },
      { name: 'KB Swing',      reps: '21 (24/16 kg)' },
      { name: 'Pull-up',       reps: '12' },
    ],
    equipment: ['kettlebell', 'pullup_bar'],
    difficulty: 'intermediate',
    notes: 'Sub 12 min is competitive. Sub 8 min is elite.',
  },
  {
    name: 'Fran', type: 'crossfit',
    format: '21-15-9 For Time',
    focus: 'Couplet — thrusters & pull-ups',
    movements: [
      { name: 'Thruster', reps: '21-15-9 (43/30 kg)' },
      { name: 'Pull-up',  reps: '21-15-9'  },
    ],
    equipment: ['barbell', 'pullup_bar'],
    difficulty: 'intermediate',
    notes: 'The most famous CrossFit benchmark. Sub 5 min is the goal.',
  },
  {
    name: 'Diane', type: 'crossfit',
    format: '21-15-9 For Time',
    focus: 'Deadlift + HSPU',
    movements: [
      { name: 'Deadlift',          reps: '21-15-9 (102/70 kg)' },
      { name: 'Handstand Push-up', reps: '21-15-9' },
    ],
    equipment: ['barbell'],
    difficulty: 'advanced',
    notes: 'Scale HSPU to pike push-ups or DB shoulder press.',
  },
  {
    name: 'Grace', type: 'crossfit',
    format: 'For Time',
    focus: 'Clean & jerk volume',
    movements: [
      { name: 'Clean & Jerk', reps: '30 (61/43 kg)' },
    ],
    equipment: ['barbell'],
    difficulty: 'intermediate',
    notes: 'Score = total time. Sub 3 min is competitive.',
  },
  {
    name: 'Jackie', type: 'crossfit',
    format: 'For Time',
    focus: 'Row + thruster + pull-up',
    movements: [
      { name: 'Row',          distance: '1000 m' },
      { name: 'Thruster',     reps: '50 (20 kg)' },
      { name: 'Pull-up',      reps: '30' },
    ],
    equipment: ['rower', 'barbell', 'pullup_bar'],
    difficulty: 'intermediate',
    notes: 'Pacing test. Don\'t blow up on the row.',
  },

  // ── EMOMs ───────────────────────────────────────────────────────────────
  {
    name: 'EMOM Strength', type: 'crossfit',
    format: 'EMOM 10 min',
    focus: 'Strength on the minute',
    movements: [
      { name: 'Power Clean', reps: '3 (60-70%)' },
    ],
    equipment: ['barbell'],
    difficulty: 'intermediate',
    notes: 'Every Minute On the Minute. Rest is whatever is left in the minute.',
  },
  {
    name: 'EMOM 12 — Push/Pull', type: 'crossfit',
    format: 'EMOM 12 min',
    focus: 'Alternating push/pull',
    movements: [
      { name: 'Min 1 — Push-up', reps: '15' },
      { name: 'Min 2 — Pull-up', reps: '8'  },
    ],
    equipment: ['pullup_bar'],
    difficulty: 'beginner',
    notes: 'Alternate each minute for 12 total. Scale reps to finish in 40s.',
  },

  // ── AMRAPS (non-named) ──────────────────────────────────────────────────
  {
    name: 'AMRAP 15 — DB Triplet', type: 'crossfit',
    format: 'AMRAP 15 min',
    focus: 'Full-body DB triplet',
    movements: [
      { name: 'DB Snatch',       reps: '10 (5/side)' },
      { name: 'Box Jump',        reps: '12' },
      { name: 'DB Push Press',   reps: '10' },
    ],
    equipment: ['dumbbell'],
    difficulty: 'intermediate',
    notes: 'Pick a DB you can move through unbroken for the first round.',
  },
  {
    name: 'AMRAP 12 — Bodyweight', type: 'crossfit',
    format: 'AMRAP 12 min',
    focus: 'No-equipment conditioning',
    movements: [
      { name: 'Burpee',     reps: '10' },
      { name: 'Air Squat',  reps: '15' },
      { name: 'Sit-up',     reps: '20' },
    ],
    equipment: [],
    difficulty: 'beginner',
    notes: 'Travel-friendly. No equipment needed.',
  },

  // ── CHIPPERS ────────────────────────────────────────────────────────────
  {
    name: '21-15-9 KB Chipper', type: 'crossfit',
    format: '21-15-9 For Time',
    focus: 'Chipper — KB swing & burpee',
    movements: [
      { name: 'KB Swing', reps: '21-15-9 (24/16 kg)' },
      { name: 'Burpee',   reps: '21-15-9' },
    ],
    equipment: ['kettlebell'],
    difficulty: 'beginner',
    notes: 'Break up reps as needed. Aim for under 8 min.',
  },
  {
    name: '50-40-30-20-10 Chipper', type: 'crossfit',
    format: '50-40-30-20-10 For Time',
    focus: 'Descending ladder',
    movements: [
      { name: 'Double-Under', reps: '50-40-30-20-10' },
      { name: 'Sit-up',       reps: '50-40-30-20-10' },
    ],
    equipment: ['jump_rope'],
    difficulty: 'intermediate',
    notes: 'Sub single-unders ×2 if double-unders aren\'t reliable yet.',
  },

  // ── BEGINNER — no/low equipment, approachable volume ─────────────────────
  {
    name: 'AMRAP 10 — Squat & Press', type: 'crossfit',
    format: 'AMRAP 10 min',
    focus: 'DB squat-to-press combo',
    movements: [
      { name: 'DB Goblet Squat', reps: '10' },
      { name: 'DB Push Press',   reps: '8'  },
      { name: 'Sit-up',          reps: '12' },
    ],
    equipment: ['dumbbell'],
    difficulty: 'beginner',
    notes: 'Pick one light-to-moderate DB. Steady, unbroken pace.',
  },
  {
    name: 'Tabata Bottom-to-Bottom', type: 'crossfit',
    format: 'Tabata 8 rounds',
    focus: 'Bodyweight squat intervals',
    movements: [
      { name: 'Air Squat', reps: '20s work / 10s rest' },
    ],
    equipment: [],
    difficulty: 'beginner',
    notes: '8 rounds of 20s on / 10s off. Rest at the bottom of the squat.',
  },
  {
    name: 'Death by Burpees', type: 'crossfit',
    format: 'EMOM ascending',
    focus: 'Burpee ladder',
    movements: [
      { name: 'Burpee', reps: '+1 each minute (1, 2, 3…)' },
    ],
    equipment: [],
    difficulty: 'beginner',
    notes: 'Minute 1 = 1 burpee, minute 2 = 2, etc. Stop when you can\'t finish in the minute.',
  },
  {
    name: 'AMRAP 12 — KB Foundations', type: 'crossfit',
    format: 'AMRAP 12 min',
    focus: 'Kettlebell basics',
    movements: [
      { name: 'KB Swing',        reps: '12 (16/12 kg)' },
      { name: 'KB Goblet Squat', reps: '10' },
      { name: 'Push-up',         reps: '8'  },
    ],
    equipment: ['kettlebell'],
    difficulty: 'beginner',
    notes: 'Learn the hip-hinge swing. Drop the bell and rest as needed.',
  },
  {
    name: 'Cindy Lite', type: 'crossfit',
    format: 'AMRAP 15 min',
    focus: 'Scaled bodyweight AMRAP',
    movements: [
      { name: 'Ring Row',  reps: '5'  },
      { name: 'Push-up',   reps: '8 (knee OK)' },
      { name: 'Air Squat', reps: '12' },
    ],
    equipment: [],
    difficulty: 'beginner',
    notes: 'Beginner version of Cindy — ring rows replace pull-ups.',
  },
  {
    name: 'EMOM 14 — Row & Rest', type: 'crossfit',
    format: 'EMOM 14 min',
    focus: 'Rowing intervals',
    movements: [
      { name: 'Row', distance: '150 m every minute' },
    ],
    equipment: ['rower'],
    difficulty: 'beginner',
    notes: 'Row 150 m, rest the remainder of each minute. Builds engine safely.',
  },
  {
    name: '3 Rounds — Steady Triplet', type: 'crossfit',
    format: '3 Rounds For Quality',
    focus: 'Controlled bodyweight rounds',
    movements: [
      { name: 'Walking Lunge', reps: '20 (10/leg)' },
      { name: 'Push-up',       reps: '12' },
      { name: 'Plank',         reps: '30s hold' },
    ],
    equipment: [],
    difficulty: 'beginner',
    notes: 'No clock pressure — move well, rest 1 min between rounds.',
  },
  {
    name: 'AMRAP 8 — Step & Swing', type: 'crossfit',
    format: 'AMRAP 8 min',
    focus: 'Low-impact conditioning',
    movements: [
      { name: 'Step-up',  reps: '20 (10/leg)' },
      { name: 'KB Swing', reps: '15 (16/12 kg)' },
    ],
    equipment: ['kettlebell'],
    difficulty: 'beginner',
    notes: 'Knee-friendly alternative to box jumps. Keep moving.',
  },

  // ── INTERMEDIATE — named benchmarks + mixed modal ────────────────────────
  {
    name: 'Barbara', type: 'crossfit',
    format: '5 Rounds For Time',
    focus: 'High-volume gymnastics',
    movements: [
      { name: 'Pull-up',   reps: '20' },
      { name: 'Push-up',   reps: '30' },
      { name: 'Sit-up',    reps: '40' },
      { name: 'Air Squat', reps: '50' },
    ],
    equipment: ['pullup_bar'],
    difficulty: 'intermediate',
    notes: 'Rest exactly 3 minutes between rounds. Score each round separately.',
  },
  {
    name: 'Chelsea', type: 'crossfit',
    format: 'EMOM 30 min',
    focus: 'Gymnastics on the minute',
    movements: [
      { name: 'Pull-up',   reps: '5'  },
      { name: 'Push-up',   reps: '10' },
      { name: 'Air Squat', reps: '15' },
    ],
    equipment: ['pullup_bar'],
    difficulty: 'intermediate',
    notes: 'Complete all three every minute for 30 min. Scale to 20 min if needed.',
  },
  {
    name: 'Karen', type: 'crossfit',
    format: 'For Time',
    focus: 'Wall ball grind',
    movements: [
      { name: 'Wall Ball', reps: '150 (9/6 kg)' },
    ],
    equipment: ['wall_ball'],
    difficulty: 'intermediate',
    notes: 'Just 150 wall balls. Sub DB thrusters if no wall-ball target.',
  },
  {
    name: 'Nancy', type: 'crossfit',
    format: '5 Rounds For Time',
    focus: 'Run + overhead squat',
    movements: [
      { name: 'Run',             distance: '400 m' },
      { name: 'Overhead Squat',  reps: '15 (43/30 kg)' },
    ],
    equipment: ['barbell'],
    difficulty: 'intermediate',
    notes: 'Tests mobility under fatigue. Drop weight to keep form.',
  },
  {
    name: 'The Chief', type: 'crossfit',
    format: '5× AMRAP 3 min',
    focus: 'Power triplet intervals',
    movements: [
      { name: 'Power Clean', reps: '3 (60/40 kg)' },
      { name: 'Push-up',     reps: '6'  },
      { name: 'Air Squat',   reps: '9'  },
    ],
    equipment: ['barbell'],
    difficulty: 'intermediate',
    notes: '5 cycles of: 3-min AMRAP, then 1-min rest. Score total rounds.',
  },
  {
    name: 'Fight Gone Bad', type: 'crossfit',
    format: '3 Rounds — 1 min per station',
    focus: 'Five-station grind',
    movements: [
      { name: 'Wall Ball',        reps: '1 min' },
      { name: 'Sumo Deadlift High Pull', reps: '1 min (35/25 kg)' },
      { name: 'Box Jump',         reps: '1 min' },
      { name: 'Push Press',       reps: '1 min (35/25 kg)' },
      { name: 'Row (calories)',   reps: '1 min' },
    ],
    equipment: ['barbell', 'wall_ball', 'rower'],
    difficulty: 'intermediate',
    notes: '1 min at each station, then 1 min rest. Score = total reps + calories.',
  },
  {
    name: 'AMRAP 16 — Row/Burpee/Box', type: 'crossfit',
    format: 'AMRAP 16 min',
    focus: 'Mixed-modal engine',
    movements: [
      { name: 'Row',      distance: '250 m' },
      { name: 'Burpee',   reps: '12' },
      { name: 'Box Jump', reps: '15' },
    ],
    equipment: ['rower'],
    difficulty: 'intermediate',
    notes: 'Pace the row so you can attack the burpees. Step down off the box.',
  },
  {
    name: 'EMOM 18 — Three Stations', type: 'crossfit',
    format: 'EMOM 18 min',
    focus: 'Rotating DB stations',
    movements: [
      { name: 'Min 1 — DB Thruster',  reps: '12' },
      { name: 'Min 2 — Burpee',       reps: '10' },
      { name: 'Min 3 — DB Renegade Row', reps: '10' },
    ],
    equipment: ['dumbbell'],
    difficulty: 'intermediate',
    notes: 'Rotate stations each minute, 6 cycles total.',
  },

  // ── ADVANCED — heavy / long / high-skill ─────────────────────────────────
  {
    name: 'Murph', type: 'crossfit',
    format: 'For Time (with vest)',
    focus: 'Hero WOD — run + gymnastics',
    movements: [
      { name: 'Run',       distance: '1 mile' },
      { name: 'Pull-up',   reps: '100' },
      { name: 'Push-up',   reps: '200' },
      { name: 'Air Squat', reps: '300' },
      { name: 'Run',       distance: '1 mile' },
    ],
    equipment: ['pullup_bar'],
    difficulty: 'advanced',
    notes: 'Partition the middle however you like (e.g. 20 rounds of Cindy). Vest optional.',
  },
  {
    name: 'DT', type: 'crossfit',
    format: '5 Rounds For Time',
    focus: 'Barbell cycling',
    movements: [
      { name: 'Deadlift',   reps: '12 (70/47 kg)' },
      { name: 'Hang Power Clean', reps: '9' },
      { name: 'Push Jerk',  reps: '6' },
    ],
    equipment: ['barbell'],
    difficulty: 'advanced',
    notes: 'All from the floor, same bar. Hero WOD — touch-and-go where possible.',
  },
  {
    name: 'Elizabeth', type: 'crossfit',
    format: '21-15-9 For Time',
    focus: 'Cleans + ring dips',
    movements: [
      { name: 'Squat Clean', reps: '21-15-9 (61/43 kg)' },
      { name: 'Ring Dip',    reps: '21-15-9' },
    ],
    equipment: ['barbell'],
    difficulty: 'advanced',
    notes: 'High-skill couplet. Sub bar dips for ring dips if needed.',
  },
  {
    name: 'Amanda', type: 'crossfit',
    format: '9-7-5 For Time',
    focus: 'Snatch + muscle-ups',
    movements: [
      { name: 'Muscle-up',     reps: '9-7-5' },
      { name: 'Squat Snatch',  reps: '9-7-5 (61/43 kg)' },
    ],
    equipment: ['barbell', 'pullup_bar'],
    difficulty: 'advanced',
    notes: 'Elite benchmark. Requires muscle-ups + a solid squat snatch.',
  },
];

export const HYROX_STATIONS = [
  // Hyrox WODs are typically a fixed sequence of 8 stations alternating with
  // 1 km runs. We model each entry as one full Hyrox-style session.
  {
    name: 'Hyrox Sim — Full', type: 'hyrox',
    format: 'Hyrox Simulation',
    focus: 'Race-pace 8-station',
    movements: [
      { name: 'Run',                 distance: '1 km' },
      { name: 'Ski Erg',             distance: '1000 m' },
      { name: 'Run',                 distance: '1 km' },
      { name: 'Sled Push',           distance: '50 m (152 kg M / 102 kg W)' },
      { name: 'Run',                 distance: '1 km' },
      { name: 'Sled Pull',           distance: '50 m (103 kg M / 78 kg W)' },
      { name: 'Run',                 distance: '1 km' },
      { name: 'Burpee Broad Jump',   distance: '80 m' },
      { name: 'Run',                 distance: '1 km' },
      { name: 'Rowing',              distance: '1000 m' },
      { name: 'Run',                 distance: '1 km' },
      { name: 'Farmers Carry',       distance: '200 m (2 × 24 kg / 16 kg)' },
      { name: 'Run',                 distance: '1 km' },
      { name: 'Sandbag Lunges',      distance: '100 m (20/10 kg)' },
      { name: 'Run',                 distance: '1 km' },
      { name: 'Wall Balls',          reps: '100 (6/4 kg)' },
    ],
    equipment: ['rower', 'sled', 'kettlebell', 'sandbag', 'wall_ball'],
    difficulty: 'advanced',
    notes: 'Full race simulation. ~90 min for competitive athletes.',
  },
  {
    name: 'Hyrox Half — 4 stations', type: 'hyrox',
    format: 'Hyrox Half',
    focus: 'Run + 4 stations',
    movements: [
      { name: 'Run',           distance: '1 km' },
      { name: 'Ski Erg',       distance: '500 m' },
      { name: 'Run',           distance: '1 km' },
      { name: 'Sled Push',     distance: '25 m' },
      { name: 'Run',           distance: '1 km' },
      { name: 'Burpee Broad Jump', distance: '40 m' },
      { name: 'Run',           distance: '1 km' },
      { name: 'Wall Balls',    reps: '50' },
    ],
    equipment: ['sled', 'wall_ball'],
    difficulty: 'intermediate',
    notes: 'Half a race. Good weekly key session in race prep.',
  },
  {
    name: 'Hyrox Compromised Cardio', type: 'hyrox',
    format: 'Compromised Cardio Circuit',
    focus: 'Run + station alternating',
    movements: [
      { name: 'Run',              distance: '400 m' },
      { name: 'Wall Balls',       reps: '20 (6 kg)' },
      { name: 'Run',              distance: '400 m' },
      { name: 'Farmers Carry',    distance: '100 m (2 × 24 kg)' },
      { name: 'Run',              distance: '400 m' },
      { name: 'Burpee Broad Jump',distance: '20 m' },
      { name: 'Run',              distance: '400 m' },
      { name: 'Sandbag Lunges',   distance: '50 m' },
    ],
    equipment: ['kettlebell', 'sandbag', 'wall_ball'],
    difficulty: 'intermediate',
    notes: 'Teaches running on tired legs — the core Hyrox skill.',
  },
  {
    name: 'Hyrox EMOM — Skills', type: 'hyrox',
    format: 'EMOM 16 min',
    focus: 'Station skill work',
    movements: [
      { name: 'Min 1 — Wall Balls',        reps: '15' },
      { name: 'Min 2 — Burpee Broad Jump', reps: '8'  },
      { name: 'Min 3 — Sandbag Lunges',    reps: '20 m' },
      { name: 'Min 4 — Rest',              reps: '—' },
    ],
    equipment: ['sandbag', 'wall_ball'],
    difficulty: 'beginner',
    notes: 'Rotate through 4 minutes, repeat 4× for 16 min total.',
  },

  // ── BEGINNER — short, light, run-engine focused ──────────────────────────
  {
    name: 'Hyrox Intro — Run & Row', type: 'hyrox',
    format: 'Run/Row Intervals',
    focus: 'Build the base engine',
    movements: [
      { name: 'Run', distance: '600 m' },
      { name: 'Row', distance: '500 m' },
      { name: 'Run', distance: '600 m' },
      { name: 'Row', distance: '500 m' },
      { name: 'Run', distance: '600 m' },
    ],
    equipment: ['rower'],
    difficulty: 'beginner',
    notes: 'Easy-moderate effort. The goal is steady aerobic time, not a race.',
  },
  {
    name: 'Hyrox Foundations — 2 stations', type: 'hyrox',
    format: 'Run + 2 stations',
    focus: 'Learn the station basics',
    movements: [
      { name: 'Run',           distance: '800 m' },
      { name: 'Wall Balls',    reps: '20 (6/4 kg)' },
      { name: 'Run',           distance: '800 m' },
      { name: 'Farmers Carry', distance: '100 m (2 × 16 kg)' },
    ],
    equipment: ['kettlebell', 'wall_ball'],
    difficulty: 'beginner',
    notes: 'Light loads. Focus on smooth transitions from run to station.',
  },
  {
    name: 'Hyrox Strength Lite', type: 'hyrox',
    format: '3 Rounds For Quality',
    focus: 'Station strength prep',
    movements: [
      { name: 'Sandbag Lunges', distance: '40 m (10/5 kg)' },
      { name: 'Wall Balls',     reps: '15' },
      { name: 'KB Farmers Hold', reps: '30s' },
    ],
    equipment: ['kettlebell', 'sandbag', 'wall_ball'],
    difficulty: 'beginner',
    notes: 'No clock. Build the strength base before adding race pace.',
  },

  // ── INTERMEDIATE — partial races + pacing work ───────────────────────────
  {
    name: 'Hyrox Quarter — 2 stations', type: 'hyrox',
    format: 'Hyrox Quarter',
    focus: 'Race-pace mini block',
    movements: [
      { name: 'Run',               distance: '1 km' },
      { name: 'Ski Erg',           distance: '500 m' },
      { name: 'Run',               distance: '1 km' },
      { name: 'Burpee Broad Jump', distance: '40 m' },
    ],
    equipment: ['rower'],
    difficulty: 'intermediate',
    notes: 'Practise race-pace running into a station and back out.',
  },
  {
    name: 'Hyrox Sled Focus', type: 'hyrox',
    format: '4 Rounds For Time',
    focus: 'Sled push + pull endurance',
    movements: [
      { name: 'Run',       distance: '400 m' },
      { name: 'Sled Push', distance: '25 m' },
      { name: 'Sled Pull', distance: '25 m' },
    ],
    equipment: ['sled'],
    difficulty: 'intermediate',
    notes: 'The sled is where races are won and lost. Short, hard efforts.',
  },
  {
    name: 'Hyrox Wall Ball Engine', type: 'hyrox',
    format: '5 Rounds For Time',
    focus: 'Compromised wall balls',
    movements: [
      { name: 'Run',        distance: '500 m' },
      { name: 'Wall Balls', reps: '25 (9/6 kg)' },
    ],
    equipment: ['wall_ball'],
    difficulty: 'intermediate',
    notes: 'The final Hyrox station is 100 wall balls — train them tired.',
  },

  // ── ADVANCED — full race + heavy simulation ──────────────────────────────
  {
    name: 'Hyrox Pro Sim', type: 'hyrox',
    format: 'Hyrox Pro Simulation',
    focus: 'Heavy race simulation',
    movements: [
      { name: 'Run',               distance: '1 km' },
      { name: 'Ski Erg',           distance: '1000 m' },
      { name: 'Run',               distance: '1 km' },
      { name: 'Sled Push',         distance: '50 m (202 kg)' },
      { name: 'Run',               distance: '1 km' },
      { name: 'Sled Pull',         distance: '50 m (153 kg)' },
      { name: 'Run',               distance: '1 km' },
      { name: 'Burpee Broad Jump', distance: '80 m' },
      { name: 'Run',               distance: '1 km' },
      { name: 'Rowing',            distance: '1000 m' },
      { name: 'Run',               distance: '1 km' },
      { name: 'Farmers Carry',     distance: '200 m (2 × 32 kg)' },
      { name: 'Run',               distance: '1 km' },
      { name: 'Sandbag Lunges',    distance: '100 m (30 kg)' },
      { name: 'Run',               distance: '1 km' },
      { name: 'Wall Balls',        reps: '100 (9 kg)' },
    ],
    equipment: ['rower', 'sled', 'kettlebell', 'sandbag', 'wall_ball'],
    difficulty: 'advanced',
    notes: 'Pro-division weights. Only attempt with a solid race already behind you.',
  },
  {
    name: 'Hyrox Double Threshold', type: 'hyrox',
    format: '6 Rounds For Time',
    focus: 'Threshold run + station',
    movements: [
      { name: 'Run',               distance: '1 km (threshold pace)' },
      { name: 'Burpee Broad Jump', distance: '50 m' },
    ],
    equipment: [],
    difficulty: 'advanced',
    notes: 'Hold threshold pace on every run rep. Brutal aerobic session.',
  },
];

/**
 * Filter WODs the user can actually do given their equipment.
 */
export function filterWodsByEquipment(wods, userEquipment = []) {
  const have = new Set([...userEquipment.map(e => e.toLowerCase()), 'bodyweight']);
  return wods.filter(wod => wod.equipment.every(req => have.has(req.toLowerCase())));
}

/**
 * Filter WODs to the user's difficulty (beginner can do beginner;
 * intermediate can do beginner + intermediate; advanced can do all).
 */
export function filterWodsByDifficulty(wods, userLevel) {
  const level = (userLevel || 'beginner').toLowerCase();
  const allowed = new Set(['beginner']);
  if (level === 'intermediate' || level === 'advanced') allowed.add('intermediate');
  if (level === 'advanced') allowed.add('advanced');
  return wods.filter(w => allowed.has(w.difficulty));
}
