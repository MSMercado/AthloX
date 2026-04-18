import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform, Alert,
  Animated, Dimensions, Image,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { signInWithProvider } from '../lib/socialAuth';
import useColors from '../lib/useColors';
import useStore from '../store/useStore';

const { width } = Dimensions.get('window');

// ── Data ─────────────────────────────────────────────────────────────────────

const ATHLETE_TYPES = [
  {
    id: 'runner',
    emoji: '🏃',
    label: 'Runner',
    desc: 'Cardio, running & endurance focused',
  },
  {
    id: 'gym',
    emoji: '🏋️',
    label: 'Gym Athlete',
    desc: 'Strength, muscle & power focused',
  },
  {
    id: 'hybrid',
    emoji: '🔥',
    label: 'Hybrid Athlete',
    desc: 'Combines strength + cardio — train like a real athlete',
    recommended: true,
  },
];

const GOALS = [
  { id: 'run_5k',       emoji: '🏅', label: 'Run my first 5K' },
  { id: 'run_10k',      emoji: '🏃', label: 'Run 10K or further' },
  { id: 'lose_weight',  emoji: '🔥', label: 'Lose weight & burn fat' },
  { id: 'build_muscle', emoji: '💪', label: 'Build muscle & strength' },
  { id: 'get_fitter',   emoji: '⚡', label: 'Get overall fitter' },
  { id: 'athletic',     emoji: '🥇', label: 'Train like an athlete' },
];

const TIMELINES = [
  { id: '4w', label: '4 Weeks',  desc: 'Quick starter sprint' },
  { id: '3m', label: '3 Months', desc: 'Solid, visible progress', hot: true },
  { id: '6m', label: '6 Months', desc: 'Real transformation' },
  { id: '1y', label: '1 Year',   desc: 'Full lifestyle change' },
];

const LEVELS = [
  { id: 'beginner',     emoji: '🌱', label: 'Beginner',     desc: 'New to structured training' },
  { id: 'intermediate', emoji: '🔥', label: 'Intermediate', desc: 'Training consistently' },
  { id: 'advanced',     emoji: '💎', label: 'Advanced',     desc: 'Serious athlete' },
];

const DAYS_OPTIONS = [3, 4, 5, 6];

const EQUIPMENT = [
  { id: 'none',  emoji: '🏠', label: 'Home / No Equipment', desc: 'Bodyweight only' },
  { id: 'bands', emoji: '🎽', label: 'Resistance Bands',    desc: 'Portable & effective' },
  { id: 'dumbs', emoji: '🏋️', label: 'Dumbbells',           desc: 'Home weights setup' },
  { id: 'gym',   emoji: '🏟️', label: 'Full Gym Access',     desc: 'All equipment available' },
];

// ── Plan Preview Builder ──────────────────────────────────────────────────────

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function buildPreviewWeek(athleteType, goal, level, daysPerWeek) {
  const isRunner = athleteType === 'runner';
  const isGym    = athleteType === 'gym';
  const isBeginner  = level === 'beginner';
  const isAdvanced  = level === 'advanced';
  const isWeightGoal = goal === 'lose_weight';
  const isRunGoal    = goal === 'run_5k' || goal === 'run_10k';
  const isMuscleGoal = goal === 'build_muscle';

  // Build a full pool of workouts based on type
  let workoutPool = [];

  if (isRunner) {
    workoutPool = [
      { icon: '🏃', name: isBeginner ? 'Easy Run (Beginner)' : 'Easy Run', detail: isBeginner ? '20 min · Walk/Run' : '30 min · Zone 2', type: 'run' },
      { icon: '🏋️', name: 'Cross Training', detail: '30 min · Strength & mobility', type: 'gym' },
      { icon: '⚡', name: isAdvanced ? 'Tempo Run' : 'Moderate Run', detail: isAdvanced ? '35 min · Threshold pace' : '25 min · Comfortable effort', type: 'run' },
      { icon: '🔥', name: isRunGoal ? 'Interval Run' : 'Cardio Burn', detail: isRunGoal ? '40 min · Speed work' : '35 min · Fat burn', type: 'run' },
      { icon: '🏅', name: 'Long Run', detail: isAdvanced ? '60 min · Endurance' : '40 min · Build base', type: 'run' },
      { icon: '🦵', name: 'Leg Strength', detail: '30 min · Support your runs', type: 'gym' },
    ];
  } else if (isGym) {
    workoutPool = [
      { icon: '💪', name: isBeginner ? 'Intro to Push' : 'Push Day', detail: isBeginner ? '40 min · Chest & Shoulders basics' : '45 min · Chest, Shoulders & Triceps', type: 'gym' },
      { icon: '🏋️', name: isBeginner ? 'Intro to Pull' : 'Pull Day', detail: isBeginner ? '40 min · Back & Biceps basics' : '45 min · Back & Biceps', type: 'gym' },
      { icon: '🦵', name: 'Leg Day', detail: isMuscleGoal ? '50 min · Quads, Hamstrings & Glutes' : '45 min · Lower body', type: 'gym' },
      { icon: '🔥', name: isWeightGoal ? 'HIIT Cardio' : 'Upper Body', detail: isWeightGoal ? '30 min · Max calorie burn' : '45 min · Full upper body', type: isWeightGoal ? 'run' : 'gym' },
      { icon: '⚡', name: isMuscleGoal ? 'Hypertrophy Day' : 'Full Body', detail: isMuscleGoal ? '50 min · Volume training' : '45 min · Compound lifts', type: 'gym' },
      { icon: '🏃', name: 'Active Cardio', detail: '25 min · Keep heart rate up', type: 'run' },
    ];
  } else {
    // hybrid
    workoutPool = [
      { icon: '🏋️', name: isBeginner ? 'Intro Strength' : 'Upper Body Strength', detail: isBeginner ? '40 min · Form & fundamentals' : '45 min · Push & Pull', type: 'gym' },
      { icon: '🏃', name: 'Easy Run', detail: isBeginner ? '20 min · Build your base' : '30 min · Zone 2 cardio', type: 'run' },
      { icon: '🦵', name: 'Lower Body Strength', detail: isAdvanced ? '50 min · Heavy compound lifts' : '45 min · Legs & Glutes', type: 'gym' },
      { icon: '⚡', name: isRunGoal ? 'Tempo Run' : 'Cardio & Core', detail: isRunGoal ? '35 min · Build race pace' : '35 min · Endurance + core', type: 'run' },
      { icon: '🔥', name: isAdvanced ? 'Power & Strength' : 'Full Body', detail: isAdvanced ? '55 min · Athletic performance' : '50 min · Compound movements', type: 'gym' },
      { icon: '🏃', name: isWeightGoal ? 'HIIT Run' : 'Interval Run', detail: isWeightGoal ? '30 min · Max burn' : '35 min · Speed development', type: 'run' },
    ];
  }

  // Slot workouts into selected days, fill rest days in between
  const days = [];
  const totalDays = 7;
  const workoutDays = Math.min(daysPerWeek, workoutPool.length);

  // Distribute workouts evenly across the week
  const spacing = totalDays / workoutDays;
  const workoutIndices = new Set(
    Array.from({ length: workoutDays }, (_, i) => Math.round(i * spacing))
  );

  let workoutIdx = 0;
  for (let i = 0; i < totalDays; i++) {
    if (workoutIndices.has(i) && workoutIdx < workoutPool.length) {
      days.push(workoutPool[workoutIdx++]);
    } else {
      days.push({ icon: '😴', name: 'Rest & Recovery', detail: 'Let your body adapt', type: 'rest' });
    }
  }
  return days;
}

// ── Equipment-aware exercise library ─────────────────────────────────────────

const EX = {
  // PUSH — chest
  push_chest: (eq, lvl) => {
    const beg = lvl === 'beginner';
    const adv = lvl === 'advanced';
    if (eq === 'gym') {
      if (beg) return { name: 'Chest Press Machine',       sets: '3', reps: '10',    note: 'Great starting point — machine guides your form' };
      return           { name: 'Barbell Bench Press',       sets: adv ? '4' : '3',   reps: adv ? '6–8' : '8–10', note: 'Control the descent, full range of motion' };
    }
    if (eq === 'dumbs') {
      if (beg) return  { name: 'Dumbbell Floor Press',     sets: '3', reps: '10',    note: 'Lying on the floor — safer for beginners' };
      return           { name: 'Dumbbell Bench Press',     sets: '3', reps: '8–10',  note: 'Keep shoulder blades pinched together' };
    }
    if (eq === 'bands') {
      if (beg) return  { name: 'Band Chest Press (seated)', sets: '3', reps: '12',  note: 'Sit on chair, anchor band behind you, press forward' };
      return           { name: 'Band Push-Ups',            sets: '3', reps: '12–15', note: 'Band across upper back adds resistance' };
    }
    // none
    if (beg) return    { name: 'Wall Push-Ups',            sets: '3', reps: '12',    note: 'Stand arms-length from wall — easiest starting point' };
    if (adv) return    { name: 'Archer Push-Ups',          sets: '4', reps: '8 each side', note: 'One arm extended to side for extra load' };
    return             { name: 'Push-Ups',                 sets: '3', reps: '10–12', note: 'Hands shoulder-width, body in straight line' };
  },

  // PUSH — shoulder
  push_shoulder: (eq, lvl) => {
    const beg = lvl === 'beginner';
    if (eq === 'gym') {
      if (beg) return  { name: 'Shoulder Press Machine',   sets: '3', reps: '12',    note: 'Machine keeps the movement safe and stable' };
      return           { name: 'Overhead Press',           sets: '3', reps: '10',    note: 'Bar just in front of face on the way up' };
    }
    if (eq === 'dumbs') {
      if (beg) return  { name: 'Seated Dumbbell Press',    sets: '3', reps: '10',    note: 'Sitting down reduces strain on lower back' };
      return           { name: 'Standing Dumbbell Press',  sets: '3', reps: '10–12', note: 'Core braced, press straight overhead' };
    }
    if (eq === 'bands') {
      return           { name: 'Band Shoulder Press',      sets: '3', reps: '12',    note: 'Stand on band, hold at shoulders and press up' };
    }
    if (beg) return    { name: 'Shoulder Taps',            sets: '3', reps: '10 each side', note: 'In push-up position, tap opposite shoulder' };
    return             { name: 'Pike Push-Ups',            sets: '3', reps: '8–10',  note: 'Hips high in an inverted V, press through shoulders' };
  },

  // PUSH — incline / upper chest
  push_incline: (eq, lvl) => {
    const beg = lvl === 'beginner';
    if (eq === 'gym') {
      if (beg) return  { name: 'Incline Chest Press Machine', sets: '3', reps: '12', note: 'Adjust seat so handles are at mid-chest' };
      return           { name: 'Incline Barbell Press',    sets: '3', reps: '10–12', note: '30–45° incline, upper chest focus' };
    }
    if (eq === 'dumbs') return { name: 'Incline Dumbbell Press', sets: '3', reps: '10–12', note: 'Prop pillows under your back if no bench' };
    if (eq === 'bands') return { name: 'Band Chest Fly',    sets: '3', reps: '12',   note: 'Anchor band at sides, bring hands together in front' };
    if (beg) return    { name: 'Incline Push-Ups',         sets: '3', reps: '10',    note: 'Hands on a table or sofa edge — easier angle' };
    return             { name: 'Decline Push-Ups',         sets: '3', reps: '10–12', note: 'Feet elevated on a chair or bed' };
  },

  // PUSH — triceps
  push_tri: (eq, lvl) => {
    const beg = lvl === 'beginner';
    if (eq === 'gym') {
      if (beg) return  { name: 'Tricep Pushdown Machine',  sets: '3', reps: '12',    note: 'Light weight — feel the back of your arm working' };
      return           { name: 'Cable Tricep Pushdown',    sets: '3', reps: '12–15', note: 'Elbows stay pinned to your sides' };
    }
    if (eq === 'dumbs') {
      if (beg) return  { name: 'Dumbbell Tricep Kickback', sets: '3', reps: '12',    note: 'Hinge forward, extend arm straight back' };
      return           { name: 'Tricep Overhead Extension', sets: '3', reps: '12',   note: 'Both hands on one dumbbell, full range of motion' };
    }
    if (eq === 'bands') return { name: 'Band Tricep Pushdown', sets: '3', reps: '15', note: 'Anchor band above head, push down keeping elbows in' };
    if (beg) return    { name: 'Tricep Dips (floor)',      sets: '3', reps: '8',      note: 'Hands behind you on floor, bend and extend elbows' };
    return             { name: 'Diamond Push-Ups',         sets: '3', reps: '8–10',  note: 'Hands close together forming a diamond shape' };
  },

  // PUSH — lateral raise
  push_lateral: (eq, lvl) => {
    const beg = lvl === 'beginner';
    if (eq === 'gym' || eq === 'dumbs') {
      if (beg) return  { name: 'Dumbbell Lateral Raise',   sets: '3', reps: '12',    note: 'Very light weight — raise arms to shoulder height only' };
      return           { name: 'Lateral Raises',           sets: '3', reps: '12–15', note: 'Slight bend in elbow, lead with elbows not wrists' };
    }
    if (eq === 'bands') return { name: 'Band Lateral Raise', sets: '3', reps: '15',  note: 'Stand on band, raise arms out to sides slowly' };
    if (beg) return    { name: 'Arm Circles',              sets: '3', reps: '20 forward + 20 back', note: 'Build shoulder stability and mobility' };
    return             { name: 'Wide Push-Ups',            sets: '3', reps: '10–12', note: 'Wider hand placement shifts load to shoulders' };
  },

  // PULL — upper back
  pull_back: (eq, lvl) => {
    const beg = lvl === 'beginner';
    if (eq === 'gym') {
      if (beg) return  { name: 'Seated Cable Row',         sets: '3', reps: '12',    note: 'Light weight — pull to belly, squeeze shoulder blades' };
      return           { name: 'Barbell Bent-Over Row',    sets: '4', reps: '8–10',  note: 'Hinge at hips, pull bar to belly button' };
    }
    if (eq === 'dumbs') {
      if (beg) return  { name: 'Supported Dumbbell Row',   sets: '3', reps: '10 each', note: 'Rest hand on table for support — focus on back squeeze' };
      return           { name: 'Dumbbell Row',             sets: '3', reps: '10 each', note: 'Knee on bench, full stretch at bottom' };
    }
    if (eq === 'bands') {
      if (beg) return  { name: 'Seated Band Row',          sets: '3', reps: '12',    note: 'Sit on floor, loop band around feet, pull to waist' };
      return           { name: 'Band Bent-Over Row',       sets: '3', reps: '12',    note: 'Stand on band, hinge forward and pull to belly' };
    }
    if (beg) return    { name: 'Lying Back Extension',     sets: '3', reps: '10',    note: 'Lie face down, lift chest slightly off floor, hold 2 sec' };
    return             { name: 'Table Row',                sets: '3', reps: '10',    note: 'Lie under a sturdy table, grip edge and pull chest up' };
  },

  // PULL — lats
  pull_lat: (eq, lvl) => {
    const beg = lvl === 'beginner';
    if (eq === 'gym') {
      if (beg) return  { name: 'Lat Pulldown (light)',     sets: '3', reps: '12',    note: 'Use light weight — pull bar to upper chest' };
      return           { name: 'Lat Pulldown',             sets: '3', reps: '10–12', note: 'Lean slightly back, pull bar to upper chest' };
    }
    if (eq === 'dumbs') {
      if (beg) return  { name: 'Dumbbell Pullover',        sets: '3', reps: '10',    note: 'Lie on back, lower dumbbell behind head slowly' };
      return           { name: 'Single Arm Dumbbell Row',  sets: '3', reps: '10 each', note: 'Full stretch at bottom, squeeze at top' };
    }
    if (eq === 'bands') {
      return           { name: 'Band Lat Pulldown',        sets: '3', reps: '12',    note: 'Anchor band overhead, pull down to chest level' };
    }
    if (beg) return    { name: 'Dead Hang (assisted)',     sets: '3', reps: '15 sec', note: 'Hang from a doorframe or low bar — builds grip & lats' };
    return             { name: 'Reverse Snow Angels',      sets: '3', reps: '12',    note: 'Lie face down, sweep arms from sides to overhead' };
  },

  // LEGS — quads
  legs_quad: (eq, lvl) => {
    const beg = lvl === 'beginner';
    const adv = lvl === 'advanced';
    if (eq === 'gym') {
      if (beg) return  { name: 'Leg Press Machine',        sets: '3', reps: '12',    note: 'Safe starting point — feet shoulder-width on platform' };
      return           { name: 'Barbell Back Squat',       sets: adv ? '4' : '3',   reps: adv ? '5–6' : '8–10', note: 'Depth at least parallel, knees track over toes' };
    }
    if (eq === 'dumbs') {
      if (beg) return  { name: 'Goblet Squat',             sets: '3', reps: '10',    note: 'Hold dumbbell at chest — helps you sit back naturally' };
      return           { name: 'Dumbbell Sumo Squat',      sets: '3', reps: '10–12', note: 'Wide stance, toes out, dumbbell hanging between legs' };
    }
    if (eq === 'bands') {
      if (beg) return  { name: 'Band-Assisted Squat',      sets: '3', reps: '12',    note: 'Hold band anchored above to help you balance' };
      return           { name: 'Band Squat',               sets: '3', reps: '12–15', note: 'Band under feet, held at shoulders for resistance' };
    }
    if (beg) return    { name: 'Chair Squat',              sets: '3', reps: '10',    note: 'Squat down until you touch a chair, stand back up' };
    if (adv) return    { name: 'Jump Squats',              sets: '4', reps: '10',    note: 'Explode upward on the way up, land softly' };
    return             { name: 'Bodyweight Squat',         sets: '3', reps: '15',    note: 'Chest up, weight in heels, knees track over toes' };
  },

  // LEGS — hamstrings/glutes
  legs_hinge: (eq, lvl) => {
    const beg = lvl === 'beginner';
    if (eq === 'gym') {
      if (beg) return  { name: 'Lying Leg Curl Machine',   sets: '3', reps: '12',    note: 'Machine isolates hamstrings safely' };
      return           { name: 'Romanian Deadlift',        sets: '3', reps: '10',    note: 'Push hips back, feel the hamstring stretch' };
    }
    if (eq === 'dumbs') {
      if (beg) return  { name: 'Glute Bridge',             sets: '3', reps: '12',    note: 'Lie on back, feet flat, push hips up and squeeze' };
      return           { name: 'Dumbbell Romanian Deadlift', sets: '3', reps: '10–12', note: 'Soft knee bend, hinge at hips' };
    }
    if (eq === 'bands') {
      return           { name: 'Band Hip Thrust',          sets: '3', reps: '15',    note: 'Band across hips, drive upward and squeeze glutes' };
    }
    if (beg) return    { name: 'Glute Bridge',             sets: '3', reps: '12',    note: 'Lie on back, feet flat on floor, push hips to ceiling' };
    return             { name: 'Single Leg Glute Bridge',  sets: '3', reps: '10 each', note: 'One leg extended, drive through planted heel' };
  },

  // LEGS — lunges
  legs_lunge: (eq, lvl) => {
    const beg = lvl === 'beginner';
    if (eq === 'gym') {
      if (beg) return  { name: 'Bodyweight Reverse Lunge', sets: '3', reps: '8 each leg', note: 'Step back — easier on knees than forward lunge' };
      return           { name: 'Barbell Walking Lunge',    sets: '3', reps: '10 each leg', note: 'Front knee stays above ankle' };
    }
    if (eq === 'dumbs') {
      if (beg) return  { name: 'Dumbbell Reverse Lunge',   sets: '3', reps: '8 each leg', note: 'Step backward, lower back knee to floor gently' };
      return           { name: 'Dumbbell Walking Lunge',   sets: '3', reps: '10 each leg', note: 'Keep torso upright and step forward' };
    }
    if (eq === 'bands') return { name: 'Band Lateral Walk', sets: '3', reps: '15 each direction', note: 'Keep constant tension in band, stay low' };
    if (beg) return    { name: 'Reverse Lunge',            sets: '3', reps: '8 each leg', note: 'Step back, lower gently — less knee strain than forward' };
    return             { name: 'Jump Lunges',              sets: '3', reps: '8 each leg', note: 'Explosive, switch legs in the air' };
  },

  // CORE
  core_plank: (lvl) => {
    const beg = lvl === 'beginner';
    if (beg) return    { name: 'Knee Plank',               sets: '3', reps: '20 sec', note: 'Knees on floor — easier starting point, still effective' };
    return             { name: 'Plank Hold',               sets: '3', reps: '30–45 sec', note: 'Straight line from head to heels, breathe steadily' };
  },
  core_crunch: (eq, lvl) => {
    const beg = lvl === 'beginner';
    if (eq === 'gym' && !beg) return { name: 'Cable Crunch', sets: '3', reps: '15',  note: 'Round spine, bring elbows toward knees' };
    if (beg) return    { name: 'Dead Bug',                  sets: '3', reps: '8 each side', note: 'Lie on back, lower opposite arm and leg slowly' };
    return             { name: 'Crunches',                  sets: '3', reps: '15–20', note: 'Lower back stays on floor, hands behind head lightly' };
  },
  core_mountain: (lvl) => {
    const beg = lvl === 'beginner';
    if (beg) return    { name: 'Slow Mountain Climbers',    sets: '3', reps: '8 each leg', note: 'Slow and controlled — build up speed over time' };
    return             { name: 'Mountain Climbers',         sets: '3', reps: '20 each leg', note: 'Hips level, drive knees fast toward chest' };
  },

  // CARDIO/HIIT
  hiit: (eq, lvl) => {
    const beg = lvl === 'beginner';
    if (eq === 'gym') {
      if (beg) return  { name: 'Treadmill Walk (incline)',  sets: null, reps: '10 min', note: '5–8% incline, brisk pace — great low-impact cardio' };
      return           { name: 'Assault Bike Sprints',      sets: '5',  reps: '30 sec on / 30 sec off', note: 'Max effort on each sprint' };
    }
    if (beg) return    { name: 'Step Touch Side to Side',   sets: '3',  reps: '45 sec', note: 'Low-impact cardio — step left, step right, keep moving' };
    return             { name: 'Burpees',                   sets: '4',  reps: '10',    note: 'Full extension at the top of each jump' };
  },
};

// ── Monday Detail Builder ─────────────────────────────────────────────────────

function buildMondayExercises(athleteType, goal, level, equipment) {
  const isBeginner   = level === 'beginner';
  const isAdvanced   = level === 'advanced';
  const isRunner     = athleteType === 'runner';
  const isWeightGoal = goal === 'lose_weight';
  const isMuscleGoal = goal === 'build_muscle';
  const isRunGoal    = goal === 'run_5k' || goal === 'run_10k';

  if (isRunner) {
    return {
      name: isBeginner ? 'Easy Run' : 'Easy Aerobic Run',
      type: 'run',
      duration: isBeginner ? '20 min' : '30 min',
      exercises: [
        { name: '5 min brisk walk warm-up',   sets: null,  reps: null,                     note: 'Gradually raise heart rate' },
        { name: isRunGoal ? 'Easy-pace run' : 'Jog at comfortable pace', sets: null, reps: isBeginner ? '10 min' : '20 min', note: 'You should be able to hold a conversation' },
        { name: '5 min walk cool-down',       sets: null,  reps: null,                     note: 'Let heart rate come down slowly' },
        { name: 'Standing hip flexor stretch', sets: '2',  reps: '30 sec each side',       note: 'Lunge position, push hips forward' },
        { name: 'Calf stretch',               sets: '2',  reps: '30 sec each side',       note: 'Against a wall, heel on ground' },
      ],
    };
  }

  if (athleteType === 'gym') {
    const name = isBeginner ? 'Intro Push Day' : isMuscleGoal ? 'Push Day (Hypertrophy)' : isWeightGoal ? 'Push Day + Cardio' : 'Push Day';
    return {
      name,
      type: 'gym',
      duration: isBeginner ? '40 min' : '50 min',
      exercises: [
        EX.push_chest(equipment, level),
        EX.push_shoulder(equipment, level),
        EX.push_incline(equipment, level),
        EX.push_lateral(equipment, level),
        isWeightGoal ? EX.hiit(equipment, level) : EX.push_tri(equipment, level),
      ],
    };
  }

  // Hybrid — Monday = Upper Body Strength
  const name = isBeginner ? 'Intro Upper Body' : isAdvanced ? 'Upper Body Power' : 'Upper Body Strength';
  return {
    name,
    type: 'gym',
    duration: isBeginner ? '40 min' : '45 min',
    exercises: [
      EX.push_chest(equipment, level),
      EX.pull_back(equipment, level),
      EX.push_shoulder(equipment, level),
      EX.pull_lat(equipment, level),
      isWeightGoal ? EX.core_mountain(level) : EX.core_plank(level),
    ],
  };
}

// Generating screen steps/messages
const GENERATING_STEPS = [
  { icon: '🧠', text: 'Analyzing your athlete profile…' },
  { icon: '🎯', text: 'Locking in your goal…' },
  { icon: '📅', text: 'Structuring your training week…' },
  { icon: '⚡', text: 'Balancing strength + cardio…' },
  { icon: '✅', text: 'Your plan is ready!' },
];

// ── Onboarding Plan Builder ───────────────────────────────────────────────────
// Maps a workout day name (from buildPreviewWeek) to a real exercise list.

function getExercisesForWorkoutDay(workoutName, equipment, level, goal) {
  const n  = (workoutName || '').toLowerCase();
  const eq = equipment || 'none';
  const lv = level     || 'beginner';
  const toEx = ex => ex
    ? { name: ex.name, sets: ex.sets || '3', reps: ex.reps || '10', rest: '60s', note: ex.note }
    : null;
  const build = (...fns) => fns.map(toEx).filter(Boolean);

  // Push / Chest day
  if (n.includes('push') || (n.includes('chest') && !n.includes('pull'))) {
    return build(
      EX.push_chest(eq, lv),
      EX.push_shoulder(eq, lv),
      EX.push_incline(eq, lv),
      EX.push_lateral(eq, lv),
      goal === 'lose_weight' ? EX.hiit(eq, lv) : EX.push_tri(eq, lv),
    );
  }
  // Pull / Back / Row day
  if (n.includes('pull') || n.includes('back') || n.includes('bicep')) {
    return build(
      EX.pull_back(eq, lv),
      EX.pull_lat(eq, lv),
      EX.push_lateral(eq, lv), // rear delt / shoulder finishing move
      EX.core_crunch(eq, lv),
      EX.core_plank(lv),
    );
  }
  // Leg day
  if (n.includes('leg') || n.includes('lower body') || n.includes('glute') || n.includes('quad')) {
    return build(
      EX.legs_quad(eq, lv),
      EX.legs_hinge(eq, lv),
      EX.legs_lunge(eq, lv),
      EX.core_plank(lv),
    );
  }
  // Upper Body (push + pull combined)
  if (n.includes('upper body') || n.includes('upper')) {
    return build(
      EX.push_chest(eq, lv),
      EX.pull_back(eq, lv),
      EX.push_shoulder(eq, lv),
      EX.pull_lat(eq, lv),
      goal === 'lose_weight' ? EX.core_mountain(lv) : EX.core_plank(lv),
    );
  }
  // Hypertrophy / Volume day
  if (n.includes('hypertrophy') || n.includes('volume')) {
    return build(
      EX.push_chest(eq, lv),
      EX.push_shoulder(eq, lv),
      EX.push_incline(eq, lv),
      EX.push_tri(eq, lv),
      EX.push_lateral(eq, lv),
    );
  }
  // Full Body / Power / Compound
  if (n.includes('full body') || n.includes('compound') || n.includes('power')) {
    return build(
      EX.push_chest(eq, lv),
      EX.pull_back(eq, lv),
      EX.legs_quad(eq, lv),
      EX.legs_hinge(eq, lv),
      EX.core_plank(lv),
    );
  }
  // Cross Training (runner's strength day)
  if (n.includes('cross training')) {
    return build(
      EX.push_chest(eq, lv),
      EX.pull_back(eq, lv),
      EX.legs_quad(eq, lv),
      EX.core_plank(lv),
      EX.core_mountain(lv),
    );
  }
  // Leg Strength (runner's leg day)
  if (n.includes('leg strength') || n.includes('legs &')) {
    return build(
      EX.legs_quad(eq, lv),
      EX.legs_hinge(eq, lv),
      EX.legs_lunge(eq, lv),
      EX.core_plank(lv),
    );
  }
  // HIIT / Cardio Burn (treat as a cardio circuit)
  if (n.includes('hiit') || n.includes('cardio burn') || n.includes('cardio +')) {
    return build(
      EX.hiit(eq, lv),
      EX.core_mountain(lv),
      EX.core_crunch(eq, lv),
    );
  }
  // Default: balanced full body
  return build(
    EX.push_chest(eq, lv),
    EX.pull_back(eq, lv),
    EX.legs_quad(eq, lv),
    EX.core_plank(lv),
  );
}

function buildOnboardingPlan(form) {
  const { athleteType, goal, level, daysPerWeek, equipment, timeline, name } = form;

  const timelineToWeeks = { '4w': 4, '3m': 12, '6m': 24, '1y': 52 };
  const durationWeeks   = timelineToWeeks[timeline] || 12;

  const goalLabels = {
    run_5k:       'Run my first 5K',
    run_10k:      'Run 10K or further',
    lose_weight:  'Lose weight & burn fat',
    build_muscle: 'Build muscle & strength',
    get_fitter:   'Get overall fitter',
    athletic:     'Train like an athlete',
  };
  const goalLabel = goalLabels[goal] || goal;

  const previewDays = buildPreviewWeek(athleteType, goal, level, daysPerWeek);
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const weeklySchedule = previewDays.map((day, i) => {
    const dayName = DAY_NAMES[i];
    if (day.type === 'rest') {
      return { day: dayName, type: 'rest', focus: 'Rest & Recovery', exercises: [] };
    }
    if (day.type === 'run') {
      return { day: dayName, type: 'cardio', focus: day.name, exercises: [] };
    }
    // Gym/strength day — build real exercises
    return {
      day: dayName,
      type: 'workout',
      focus: day.name,
      exercises: getExercisesForWorkoutDay(day.name, equipment, level, goal),
    };
  });

  const firstName = name?.split(' ')[0] || 'Athlete';
  const typeLabels = { runner: 'Runner', gym: 'Gym', hybrid: 'Hybrid Athlete' };
  const mid = Math.ceil(durationWeeks / 2);

  return {
    planName:      `${firstName}'s ${typeLabels[athleteType] || 'Fitness'} Plan`,
    goal:          goalLabel,
    durationWeeks,
    daysPerWeek,
    startDate:     new Date().toISOString(),
    weeklySchedule,
    progression:   `Weeks 1–${Math.ceil(durationWeeks * 0.33)}: Focus on form and building the habit. Weeks ${Math.ceil(durationWeeks * 0.33) + 1}–${mid}: Increase weight/intensity — aim for progressive overload each session. Weeks ${mid + 1}–${durationWeeks}: Push harder, add volume, and chase your peak.`,
    coachNote:     `Welcome to AthloX, ${firstName}! This plan was built around your goal of "${goalLabel}". Stay consistent, follow the structure, and you'll be amazed at what you achieve in ${durationWeeks} weeks. Every rep counts. 💪`,
    fromOnboarding: true,
  };
}

// ── Main Component ────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7;

export default function SignupScreen({ onBack, onSwitch }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { setWorkoutPlan } = useStore();

  const [step, setStep]           = useState(0);
  const [loading, setLoading]     = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);
  const [socialErr, setSocialErr] = useState('');
  const [planReady, setPlanReady] = useState(false);
  const [genStep, setGenStep]     = useState(0);
  const slideAnim  = useRef(new Animated.Value(0)).current;
  const genFadeAnim = useRef(new Animated.Value(0)).current;

  // When user reaches step 5, run the "generating" animation then reveal the plan
  useEffect(() => {
    if (step !== 5) { setPlanReady(false); setGenStep(0); return; }
    setPlanReady(false);
    setGenStep(0);
    genFadeAnim.setValue(0);

    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      setGenStep(current);
      if (current >= GENERATING_STEPS.length - 1) {
        clearInterval(interval);
        setTimeout(() => setPlanReady(true), 600);
      }
    }, 520);
    return () => clearInterval(interval);
  }, [step]);

  const [form, setForm] = useState({
    athleteType: '',
    goal:        '',
    timeline:    '',
    level:       '',
    daysPerWeek: 4,
    equipment:   '',
    name:        '',
    email:       '',
    password:    '',
    weight:      '',
    height:      '',
  });

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const animateNext = (dir = 1) => {
    slideAnim.setValue(dir * width);
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true,
      tension: 65, friction: 11,
    }).start();
  };

  const next = () => { animateNext(1); setStep(s => s + 1); };
  const back = () => {
    if (step === 0) { onBack(); return; }
    animateNext(-1);
    setStep(s => s - 1);
  };

  const handleSocial = async (provider) => {
    setSocialLoading(provider);
    setSocialErr('');
    try {
      await signInWithProvider(provider);
    } catch (e) {
      if (e.message === 'EXPO_GO') {
        setSocialErr('Social login needs a dev build — use email to test for now.');
      } else if (e.message !== 'Login cancelled') {
        setSocialErr(e.message || 'Sign in failed. Try again.');
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const finish = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          full_name:    form.name.trim(),
          athlete_type: form.athleteType,
          goal:         form.goal,
          level:        form.level,
        },
      },
    });
    if (error) {
      Alert.alert('Signup failed', error.message);
      setLoading(false);
      return;
    }
    if (data.user) {
      await supabase.from('profiles').upsert({
        id:            data.user.id,
        name:          form.name,
        email:         form.email.trim(),
        athlete_type:  form.athleteType,
        goal:          form.goal,
        timeline:      form.timeline,
        level:         form.level,
        days_per_week: form.daysPerWeek,
        equipment:     form.equipment,
        weight:        form.weight,
        height:        form.height,
        streak:        0,
        workouts:      0,
        xp:            0,
      });

      // Save the onboarding plan as the user's live workout plan
      // so it's ready the moment they hit the Plan tab
      const plan = buildOnboardingPlan(form);
      setWorkoutPlan(plan);
    }
    setLoading(false);
  };

  // ── Reusable sub-components ───────────────────────────────────────────────

  const OptionCard = ({ emoji, label, desc, selected, onPress, badge }) => (
    <TouchableOpacity
      style={[styles.optionCard, selected && styles.optionCardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.optionEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {desc ? <Text style={styles.optionDesc}>{desc}</Text> : null}
      </View>
      <View style={[styles.optionDot, selected && styles.optionDotSelected]}>
        {selected && <View style={styles.optionDotInner} />}
      </View>
    </TouchableOpacity>
  );

  const ContinueBtn = ({ onPress, disabled, label = 'Continue →' }) => (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading
        ? <ActivityIndicator color="#fff" />
        : <Text style={styles.btnText}>{label}</Text>
      }
    </TouchableOpacity>
  );

  // ── Steps ─────────────────────────────────────────────────────────────────

  const previewWeek = useMemo(
    () => buildPreviewWeek(form.athleteType, form.goal, form.level, form.daysPerWeek),
    [form.athleteType, form.goal, form.level, form.daysPerWeek],
  );

  const mondayDetail = useMemo(
    () => buildMondayExercises(form.athleteType, form.goal, form.level, form.equipment),
    [form.athleteType, form.goal, form.level, form.equipment],
  );

  const goalLabel     = GOALS.find(g => g.id === form.goal)?.label || '';
  const timelineLabel = TIMELINES.find(t => t.id === form.timeline)?.label || '';
  const athleteLabel  = ATHLETE_TYPES.find(a => a.id === form.athleteType)?.label || '';
  const levelLabel    = LEVELS.find(l => l.id === form.level)?.label || '';

  const steps = [

    // ── Step 0: Identity Hook ───────────────────────────────────────────────
    <View key={0} style={styles.stepWrap}>
      <Text style={styles.stepEmoji}>🏟️</Text>
      <Text style={styles.stepTitle}>What kind of athlete are you?</Text>
      <Text style={styles.stepSub}>We'll build your entire system around this</Text>
      <View style={styles.optionList}>
        {ATHLETE_TYPES.map(a => (
          <OptionCard
            key={a.id}
            emoji={a.emoji}
            label={a.label}
            desc={a.desc}
            selected={form.athleteType === a.id}
            badge={a.recommended ? 'Recommended' : null}
            onPress={() => upd('athleteType', a.id)}
          />
        ))}
      </View>
      <ContinueBtn onPress={next} disabled={!form.athleteType} />
    </View>,

    // ── Step 1: Goal ────────────────────────────────────────────────────────
    <View key={1} style={styles.stepWrap}>
      <Text style={styles.stepEmoji}>🎯</Text>
      <Text style={styles.stepTitle}>What's your #1 goal?</Text>
      <Text style={styles.stepSub}>Your entire plan will be built around this</Text>
      <View style={styles.goalGrid}>
        {GOALS.map(g => {
          const selected = form.goal === g.id;
          return (
            <TouchableOpacity
              key={g.id}
              style={[styles.goalCard, selected && styles.goalCardSelected]}
              onPress={() => upd('goal', g.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.goalEmoji}>{g.emoji}</Text>
              <Text style={[styles.goalLabel, selected && styles.goalLabelSelected]}>
                {g.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <ContinueBtn onPress={next} disabled={!form.goal} />
    </View>,

    // ── Step 2: Timeline ────────────────────────────────────────────────────
    <View key={2} style={styles.stepWrap}>
      <Text style={styles.stepEmoji}>📅</Text>
      <Text style={styles.stepTitle}>By when?</Text>
      <Text style={styles.stepSub}>Set a target — athletes with goals are 3× more consistent</Text>
      <View style={styles.timelineGrid}>
        {TIMELINES.map(t => {
          const selected = form.timeline === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.timelineCard, selected && styles.timelineCardSelected]}
              onPress={() => upd('timeline', t.id)}
              activeOpacity={0.8}
            >
              {t.hot && (
                <View style={[styles.hotBadge, { backgroundColor: colors.accent }]}>
                  <Text style={styles.hotBadgeText}>🔥 Popular</Text>
                </View>
              )}
              <Text style={[styles.timelineLabel, selected && styles.timelineLabelSelected]}>
                {t.label}
              </Text>
              <Text style={styles.timelineDesc}>{t.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <ContinueBtn onPress={next} disabled={!form.timeline} />
    </View>,

    // ── Step 3: Level + Days ────────────────────────────────────────────────
    <View key={3} style={styles.stepWrap}>
      <Text style={styles.stepEmoji}>📊</Text>
      <Text style={styles.stepTitle}>Your current level?</Text>
      <Text style={styles.stepSub}>Be honest — no judgement here</Text>
      <View style={styles.optionList}>
        {LEVELS.map(l => (
          <OptionCard
            key={l.id}
            emoji={l.emoji}
            label={l.label}
            desc={l.desc}
            selected={form.level === l.id}
            onPress={() => upd('level', l.id)}
          />
        ))}
      </View>

      <Text style={[styles.sectionLabel, { color: colors.text }]}>
        How many days can you train per week?
      </Text>
      <View style={styles.daysRow}>
        {DAYS_OPTIONS.map(d => (
          <TouchableOpacity
            key={d}
            style={[styles.dayBtn, form.daysPerWeek === d && styles.dayBtnSelected]}
            onPress={() => upd('daysPerWeek', d)}
            activeOpacity={0.8}
          >
            <Text style={[styles.dayBtnNum, form.daysPerWeek === d && styles.dayBtnNumSelected]}>
              {d}
            </Text>
            <Text style={[styles.dayBtnLabel, form.daysPerWeek === d && { color: colors.accent }]}>
              days
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ContinueBtn onPress={next} disabled={!form.level} />
    </View>,

    // ── Step 4: Equipment ───────────────────────────────────────────────────
    <View key={4} style={styles.stepWrap}>
      <Text style={styles.stepEmoji}>🏋️</Text>
      <Text style={styles.stepTitle}>What equipment do you have?</Text>
      <Text style={styles.stepSub}>We'll build workouts around what you've got</Text>
      <View style={styles.optionList}>
        {EQUIPMENT.map(e => (
          <OptionCard
            key={e.id}
            emoji={e.emoji}
            label={e.label}
            desc={e.desc}
            selected={form.equipment === e.id}
            onPress={() => upd('equipment', e.id)}
          />
        ))}
      </View>
      <ContinueBtn onPress={next} disabled={!form.equipment} />
    </View>,

    // ── Step 5: Plan Preview (Generating → Reveal) ──────────────────────────
    <View key={5} style={styles.stepWrap}>
      {!planReady ? (
        // ── Generating animation ──────────────────────────────────────────
        <View style={styles.generatingWrap}>
          <Text style={styles.generatingTitle}>Building your plan…</Text>
          <Text style={[styles.generatingSubtitle, { color: colors.text2 }]}>
            Personalising for a {levelLabel} {athleteLabel}
          </Text>
          <View style={[styles.generatingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {GENERATING_STEPS.map((s, i) => {
              const done    = i < genStep;
              const active  = i === genStep;
              const pending = i > genStep;
              return (
                <View key={i} style={styles.genRow}>
                  <View style={[
                    styles.genDot,
                    done    && { backgroundColor: colors.accent },
                    active  && { backgroundColor: colors.accent, opacity: 0.6 },
                    pending && { backgroundColor: colors.border },
                  ]}>
                    {done && <Text style={styles.genDotText}>✓</Text>}
                    {active && <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scale: 0.6 }] }} />}
                  </View>
                  <Text style={[
                    styles.genText,
                    { color: done ? colors.text : active ? colors.text : colors.text3 },
                    done && { fontWeight: '700' },
                  ]}>
                    {s.text}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Profile summary chips */}
          <View style={styles.genChips}>
            {[
              { label: athleteLabel, icon: form.athleteType === 'runner' ? '🏃' : form.athleteType === 'gym' ? '🏋️' : '🔥' },
              { label: goalLabel,    icon: '🎯' },
              { label: timelineLabel, icon: '📅' },
              { label: `${form.daysPerWeek}x / week`, icon: '⚡' },
            ].map((chip, i) => (
              <View key={i} style={[styles.genChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={styles.genChipIcon}>{chip.icon}</Text>
                <Text style={[styles.genChipText, { color: colors.text2 }]}>{chip.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        // ── Plan revealed ─────────────────────────────────────────────────
        <>
          <View style={[styles.planReadyBadge, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '44' }]}>
            <Text style={[styles.planReadyBadgeText, { color: colors.accent }]}>✅ Your plan is ready</Text>
          </View>
          <Text style={styles.stepTitle}>Your {timelineLabel} Plan</Text>
          <Text style={styles.stepSub}>
            <Text style={{ color: colors.accent, fontWeight: '800' }}>{form.daysPerWeek}x/week</Text>
            {' · '}{levelLabel}{' · '}{goalLabel}
          </Text>

          {/* Monday — Full Detail */}
          <View style={[styles.mondayCard, { backgroundColor: colors.surface, borderColor: colors.accent + '55' }]}>
            <View style={styles.mondayHeader}>
              <View>
                <Text style={[styles.mondayDayLabel, { color: colors.accent }]}>MONDAY — DAY 1</Text>
                <Text style={[styles.mondayWorkoutName, { color: colors.text }]}>{mondayDetail.name}</Text>
              </View>
              <View style={[styles.mondayDurationChip, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '33' }]}>
                <Text style={[styles.mondayDurationText, { color: colors.accent }]}>⏱ {mondayDetail.duration}</Text>
              </View>
            </View>

            {mondayDetail.exercises.map((ex, i) => (
              <View key={i} style={[styles.exRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={[styles.exNumBadge, { backgroundColor: colors.accent + '15' }]}>
                  <Text style={[styles.exNum, { color: colors.accent }]}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.exName, { color: colors.text }]}>{ex.name}</Text>
                  {(ex.sets || ex.reps) && (
                    <Text style={[styles.exMeta, { color: colors.accent }]}>
                      {ex.sets ? `${ex.sets} sets` : ''}{ex.sets && ex.reps ? ' × ' : ''}{ex.reps || ''}
                    </Text>
                  )}
                  {ex.note && <Text style={[styles.exNote, { color: colors.text3 }]}>{ex.note}</Text>}
                </View>
              </View>
            ))}
          </View>

          {/* Rest of week — locked */}
          <View style={[styles.lockedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.lockedHeader}>
              <Text style={[styles.lockedTitle, { color: colors.text }]}>📅 Full Week Plan</Text>
              <View style={[styles.lockBadge, { backgroundColor: colors.border }]}>
                <Text style={[styles.lockBadgeText, { color: colors.text3 }]}>🔒 Locked</Text>
              </View>
            </View>
            {previewWeek.slice(1).map((day, i) => (
              <View key={i} style={[styles.lockedRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={[styles.lockedDay, { color: colors.text3 }]}>{DAY_LABELS[i + 1]}</Text>
                <Text style={styles.lockedIcon}>{day.icon}</Text>
                <View style={[styles.lockedNameBar, { backgroundColor: colors.border + '99' }]} />
              </View>
            ))}
            <View style={[styles.lockedOverlay, { backgroundColor: colors.bg + 'CC' }]}>
              <Text style={styles.lockEmoji}>🔒</Text>
              <Text style={[styles.lockedOverlayText, { color: colors.text }]}>
                Create your free account to{'\n'}unlock your full {timelineLabel} plan
              </Text>
            </View>
          </View>

          <ContinueBtn onPress={next} label="Unlock My Full Plan →" />
        </>
      )}
    </View>,

    // ── Step 6: Account + Body Metrics ─────────────────────────────────────
    <View key={6} style={styles.stepWrap}>
      <Text style={styles.stepEmoji}>🔐</Text>
      <Text style={styles.stepTitle}>Create your account</Text>
      <Text style={styles.stepSub}>Save your plan and start training</Text>

      <TextInput
        style={styles.input}
        placeholder="Your full name"
        placeholderTextColor={colors.text3}
        value={form.name}
        onChangeText={v => upd('name', v)}
        autoCapitalize="words"
      />

      {/* Social login */}
      <TouchableOpacity
        style={styles.socialBtn}
        onPress={() => handleSocial('facebook')}
        disabled={!!socialLoading}
        activeOpacity={0.85}
      >
        {socialLoading === 'facebook'
          ? <ActivityIndicator color="#fff" style={{ marginRight: 12 }} />
          : <Text style={styles.socialBtnIcon}>f</Text>
        }
        <Text style={styles.socialBtnText}>Continue with Facebook</Text>
        <Text style={styles.socialBtnNote}>Instagram</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.socialBtn, styles.socialBtnX]}
        onPress={() => handleSocial('twitter')}
        disabled={!!socialLoading}
        activeOpacity={0.85}
      >
        {socialLoading === 'twitter'
          ? <ActivityIndicator color="#fff" style={{ marginRight: 12 }} />
          : <Text style={styles.socialBtnIcon}>𝕏</Text>
        }
        <Text style={styles.socialBtnText}>Continue with X</Text>
        <Text style={styles.socialBtnNote}> </Text>
      </TouchableOpacity>

      {!!socialErr && <Text style={styles.socialErrText}>{socialErr}</Text>}

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or sign up with email</Text>
        <View style={styles.dividerLine} />
      </View>

      <TextInput
        style={styles.input}
        placeholder="Email address"
        placeholderTextColor={colors.text3}
        value={form.email}
        onChangeText={v => upd('email', v)}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min 8 characters)"
        placeholderTextColor={colors.text3}
        value={form.password}
        onChangeText={v => upd('password', v)}
        secureTextEntry
      />
      {form.password.length > 0 && form.password.length < 8 && (
        <Text style={styles.passwordError}>Password must be at least 8 characters</Text>
      )}

      {/* Body metrics — used to personalise calorie & pace zones */}
      <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 8 }]}>Your body stats</Text>
      <Text style={[styles.metricHint, { color: colors.text3 }]}>Helps factor calorie targets into your plan</Text>
      <View style={styles.metricRow}>
        <View style={styles.metricBox}>
          <Text style={[styles.metricLabel, { color: colors.text3 }]}>Weight</Text>
          <TextInput
            style={[styles.metricInput, { color: colors.text }]}
            placeholder="70"
            placeholderTextColor={colors.text3}
            value={form.weight}
            onChangeText={v => upd('weight', v)}
            keyboardType="numeric"
          />
          <Text style={[styles.metricUnit, { color: colors.text3 }]}>kg</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={[styles.metricLabel, { color: colors.text3 }]}>Height</Text>
          <TextInput
            style={[styles.metricInput, { color: colors.text }]}
            placeholder="175"
            placeholderTextColor={colors.text3}
            value={form.height}
            onChangeText={v => upd('height', v)}
            keyboardType="numeric"
          />
          <Text style={[styles.metricUnit, { color: colors.text3 }]}>cm</Text>
        </View>
      </View>

      <ContinueBtn
        onPress={finish}
        label="Start Training →"
        disabled={!form.name.trim() || !form.email.trim() || form.password.length < 8}
      />
      <TouchableOpacity
        onPress={() => { if (form.name.trim() && form.email.trim() && form.password.length >= 8) finish(); }}
        style={styles.skipBtn}
      >
        <Text style={styles.skipText}>Skip body stats for now</Text>
      </TouchableOpacity>
    </View>,
  ];

  const progress = (step + 1) / TOTAL_STEPS;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={back} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.accent }]} />
        </View>
        <Text style={styles.stepCounter}>{step + 1}/{TOTAL_STEPS}</Text>
      </View>

      {/* Step content */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
          {steps[step]}
        </Animated.View>

        {/* Progress dots */}
        <View style={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: colors.border },
                i === step && [styles.dotActive, { backgroundColor: colors.accent }],
                i < step  && { backgroundColor: colors.accent, opacity: 0.4 },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity onPress={onSwitch} style={styles.switchRow}>
          <Text style={styles.switchText}>
            Already have an account?{' '}
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (colors) => StyleSheet.create({
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, gap: 12 },
  backBtn:          { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  backText:         { fontSize: 18, color: colors.text, fontWeight: '600' },
  progressTrack:    { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill:     { height: 6, borderRadius: 3 },
  stepCounter:      { fontSize: 12, color: colors.text3, fontWeight: '600', width: 32, textAlign: 'right' },

  logoRow:          { alignItems: 'center', marginBottom: 4 },
  logo:             { width: 110, height: 50 },

  scroll:           { paddingHorizontal: 24, paddingBottom: 40 },

  // Step
  stepWrap:         { paddingTop: 8 },
  stepEmoji:        { fontSize: 40, marginBottom: 12 },
  stepTitle:        { fontSize: 26, fontWeight: '900', color: colors.text, marginBottom: 6, lineHeight: 32 },
  stepSub:          { fontSize: 15, color: colors.text2, marginBottom: 24, lineHeight: 22 },
  sectionLabel:     { fontSize: 14, fontWeight: '700', marginBottom: 12, marginTop: 4 },

  // Option cards
  optionList:       { gap: 10, marginBottom: 24 },
  optionCard:       { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: colors.border },
  optionCardSelected: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  optionEmoji:      { fontSize: 26, width: 36, textAlign: 'center' },
  optionLabel:      { fontSize: 16, fontWeight: '700', color: colors.text },
  optionLabelSelected: { color: colors.accent },
  optionDesc:       { fontSize: 13, color: colors.text2, marginTop: 2 },
  optionDot:        { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  optionDotSelected: { borderColor: colors.accent },
  optionDotInner:   { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },

  // Badge
  badge:            { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:        { fontSize: 10, color: '#fff', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  // Goal grid (2 columns)
  goalGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  goalCard:         { width: (width - 48 - 10) / 2, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', gap: 8 },
  goalCardSelected: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  goalEmoji:        { fontSize: 28 },
  goalLabel:        { fontSize: 13, fontWeight: '700', color: colors.text, textAlign: 'center', lineHeight: 18 },
  goalLabelSelected:{ color: colors.accent },

  // Timeline grid (2 columns)
  timelineGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  timelineCard:     { width: (width - 48 - 10) / 2, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', gap: 4, position: 'relative', minHeight: 90, justifyContent: 'center' },
  timelineCardSelected: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  timelineLabel:    { fontSize: 20, fontWeight: '900', color: colors.text },
  timelineLabelSelected: { color: colors.accent },
  timelineDesc:     { fontSize: 12, color: colors.text3, textAlign: 'center' },
  hotBadge:         { position: 'absolute', top: -1, right: -1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderTopRightRadius: 14 },
  hotBadgeText:     { fontSize: 10, color: '#fff', fontWeight: '700' },

  // Days row
  daysRow:          { flexDirection: 'row', gap: 10, marginBottom: 24 },
  dayBtn:           { flex: 1, backgroundColor: colors.surface, borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
  dayBtnSelected:   { borderColor: colors.accent, backgroundColor: colors.accentDim },
  dayBtnNum:        { fontSize: 22, fontWeight: '900', color: colors.text },
  dayBtnNumSelected:{ color: colors.accent },
  dayBtnLabel:      { fontSize: 11, color: colors.text3, fontWeight: '600', marginTop: 2 },

  // Generating screen
  generatingWrap:    { paddingTop: 16 },
  generatingTitle:   { fontSize: 26, fontWeight: '900', color: colors.text, marginBottom: 6 },
  generatingSubtitle:{ fontSize: 15, marginBottom: 24, lineHeight: 22 },
  generatingCard:    { borderRadius: 18, borderWidth: 1, padding: 20, marginBottom: 24, gap: 16 },
  genRow:            { flexDirection: 'row', alignItems: 'center', gap: 14 },
  genDot:            { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  genDotText:        { color: '#fff', fontSize: 13, fontWeight: '800' },
  genText:           { fontSize: 14, lineHeight: 20, flex: 1 },
  genChips:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genChip:           { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  genChipIcon:       { fontSize: 14 },
  genChipText:       { fontSize: 13, fontWeight: '600' },

  // Plan Preview
  planReadyBadge:   { alignSelf: 'flex-start', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
  planReadyBadgeText:{ fontSize: 13, fontWeight: '700' },
  weekPreview:      { borderRadius: 18, borderWidth: 1, marginBottom: 24, overflow: 'hidden' },
  weekPreviewTitle: { fontSize: 14, fontWeight: '800', padding: 14, paddingBottom: 10 },
  previewRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  previewDay:       { fontSize: 11, fontWeight: '700', width: 28, textTransform: 'uppercase' },
  previewIcon:      { fontSize: 18, width: 26, textAlign: 'center' },
  previewName:      { fontSize: 13, fontWeight: '700' },
  previewDetail:    { fontSize: 11, marginTop: 1 },
  previewTag:       { borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  previewTagText:   { fontSize: 11, fontWeight: '700' },

  // Monday detail card
  mondayCard:        { borderRadius: 18, borderWidth: 1.5, marginBottom: 12, overflow: 'hidden' },
  mondayHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, paddingBottom: 10 },
  mondayDayLabel:    { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  mondayWorkoutName: { fontSize: 16, fontWeight: '900' },
  mondayDurationChip:{ borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  mondayDurationText:{ fontSize: 12, fontWeight: '700' },
  exRow:             { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  exNumBadge:        { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  exNum:             { fontSize: 12, fontWeight: '800' },
  exName:            { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  exMeta:            { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  exNote:            { fontSize: 12 },

  // Locked card
  lockedCard:        { borderRadius: 18, borderWidth: 1, marginBottom: 24, overflow: 'hidden', position: 'relative' },
  lockedHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, paddingBottom: 10 },
  lockedTitle:       { fontSize: 14, fontWeight: '800' },
  lockBadge:         { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  lockBadgeText:     { fontSize: 12, fontWeight: '700' },
  lockedRow:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  lockedDay:         { fontSize: 11, fontWeight: '700', width: 28, textTransform: 'uppercase' },
  lockedIcon:        { fontSize: 18, width: 26, textAlign: 'center' },
  lockedNameBar:     { flex: 1, height: 10, borderRadius: 5 },
  lockedOverlay:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 10 },
  lockEmoji:         { fontSize: 28 },
  lockedOverlayText: { fontSize: 15, fontWeight: '700', textAlign: 'center', lineHeight: 22 },

  // Social buttons
  socialBtn:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1877f2', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10 },
  socialBtnX:       { backgroundColor: '#000' },
  socialBtnIcon:    { fontSize: 17, color: '#fff', fontWeight: '800', width: 26, textAlign: 'center', marginRight: 4 },
  socialBtnText:    { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  socialBtnNote:    { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  socialErrText:    { color: '#ef4444', fontSize: 13, marginBottom: 8, textAlign: 'center' },
  divider:          { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 10 },
  dividerLine:      { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText:      { fontSize: 12, color: colors.text3, fontWeight: '500' },

  // Input
  input:            { backgroundColor: colors.surface, borderRadius: 16, padding: 16, fontSize: 16, color: colors.text, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  passwordError:    { fontSize: 13, color: '#ef4444', marginTop: -8, marginBottom: 12, paddingHorizontal: 4 },
  metricHint:       { fontSize: 13, marginBottom: 12, marginTop: -8 },

  // Metric inputs
  metricRow:        { flexDirection: 'row', gap: 12, marginBottom: 24 },
  metricBox:        { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  metricLabel:      { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  metricInput:      { fontSize: 28, fontWeight: '800', width: '100%', textAlign: 'center' },
  metricUnit:       { fontSize: 13, marginTop: 4, fontWeight: '600' },

  // Button
  btn:              { backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 17, alignItems: 'center', marginBottom: 12, shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  btnDisabled:      { backgroundColor: colors.border, shadowOpacity: 0 },
  btnText:          { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipBtn:          { alignItems: 'center', padding: 10, marginBottom: 8 },
  skipText:         { fontSize: 14, color: colors.text3 },

  // Dots
  dots:             { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 28, marginBottom: 16 },
  dot:              { width: 6, height: 6, borderRadius: 3 },
  dotActive:        { width: 20 },

  // Footer
  switchRow:        { alignItems: 'center', paddingBottom: 8 },
  switchText:       { fontSize: 14, color: colors.text2 },
});
