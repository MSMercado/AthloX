import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Modal, ActivityIndicator, Alert, BackHandler,
  Animated, PanResponder,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import useStore from '../store/useStore';
import useColors from '../lib/useColors';
import { shadow } from '../lib/theme';
import HeaderActions from '../components/HeaderActions';
import { EXERCISES } from '../data/exercises';
import { TUTORIALS } from '../data/exerciseTutorials';
import { supabase } from '../lib/supabase';
import { generatePlan } from '../lib/planGenerator';
import { goalHasAnyScaffold } from '../data/planScaffolds';
import { schedulePlanWorkoutReminders } from '../lib/notifications';

// Name-based tutorial lookup — plan exercises from AI have names but no numeric IDs.
// LLM-generated names often add modifiers ("Barbell Bench Press", "Dumbbell Shoulder Press",
// "Wide-Grip Pull-Ups") that don't match the canonical exercise list verbatim, so we use
// normalized + token-overlap matching as a fallback.
const STOP_TOKENS = new Set([
  'the','a','an','and','or','with','to','for','of','on','in','at',
  'standing','seated','lying','kneeling','single','double','one','two','both',
]);
const normalizeName = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[\(\)\[\]]/g, ' ')
    .replace(/[-_/]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const tokenizeName = (s) =>
  normalizeName(s).split(' ').filter(t => t && !STOP_TOKENS.has(t));

// Build lookup tables
const TUTORIALS_BY_NAME = {};       // exact normalized → tutorial
const TUTORIAL_ENTRIES  = [];       // [{ tutorial, tokens }] for fuzzy fallback
EXERCISES.forEach(ex => {
  if (TUTORIALS[ex.id]) {
    const norm = normalizeName(ex.name);
    TUTORIALS_BY_NAME[norm] = TUTORIALS[ex.id];
    TUTORIAL_ENTRIES.push({
      tutorial: TUTORIALS[ex.id],
      name: ex.name,
      tokens: tokenizeName(ex.name),
    });
  }
});

const getPlanTutorial = (name) => {
  if (!name) return null;
  // 1. Exact normalized match
  const norm = normalizeName(name);
  if (TUTORIALS_BY_NAME[norm]) return TUTORIALS_BY_NAME[norm];

  // 2. Token overlap — find the tutorial whose tokens overlap most with the input
  const inputTokens = new Set(tokenizeName(name));
  if (inputTokens.size === 0) return null;
  let best = null;
  let bestScore = 0;
  for (const entry of TUTORIAL_ENTRIES) {
    if (entry.tokens.length === 0) continue;
    const matched = entry.tokens.filter(t => inputTokens.has(t)).length;
    // Require either: all canonical tokens appear in input (canonical is subset),
    // OR all input tokens appear in canonical (input is subset)
    const canonicalCovered = matched / entry.tokens.length;
    const inputCovered     = matched / inputTokens.size;
    const score = Math.max(canonicalCovered, inputCovered);
    if (score >= 0.75 && score > bestScore) {
      best = entry.tutorial;
      bestScore = score;
    }
  }
  return best;
};

// GROQ is now called via the Supabase Edge Function `groq-proxy` — the API key lives server-side.

const GOALS = [
  { id: 'lose_fat',     label: 'Lose Fat',             icon: '🔥', desc: 'Burn calories & reduce body fat' },
  { id: 'build_muscle', label: 'Build Muscle',          icon: '💪', desc: 'Increase muscle mass & size' },
  { id: 'get_strong',   label: 'Get Stronger',          icon: '🏋️', desc: 'Increase strength & power' },
  { id: 'run_5k',       label: 'Run a 5K',              icon: '🏃', desc: 'Build up to 5 km / 3.1 mi' },
  { id: 'run_10k',      label: 'Run a 10K',             icon: '🏃', desc: 'Build up to 10 km / 6.2 mi' },
  { id: 'run_half',     label: 'Run a Half Marathon',   icon: '🏅', desc: 'Train for 21.1 km / 13.1 mi' },
  { id: 'run_marathon', label: 'Run a Marathon',        icon: '🏆', desc: 'Train for 42.2 km / 26.2 mi' },
  { id: 'crossfit',     label: 'Train CrossFit',        icon: '⚡', desc: 'AMRAPs, EMOMs, chippers — functional fitness' },
  { id: 'hyrox',        label: 'Train for Hyrox',       icon: '🔥', desc: 'Sled push, farmer carry, ski erg, run intervals' },
  { id: 'endurance',    label: 'Improve Endurance',     icon: '🫁', desc: 'Build cardio for any sport' },
  { id: 'athletic',     label: 'Athletic Performance',  icon: '🥇', desc: 'Train like a competitive athlete' },
  { id: 'general',      label: 'General Fitness',       icon: '⚡', desc: 'Overall health & wellness' },
];

const DURATIONS = [
  { weeks: 6,  label: '6 Weeks',  tag: 'Quick Sprint'       },
  { weeks: 12, label: '12 Weeks', tag: 'Most Popular', hot: true },
  { weeks: 16, label: '16 Weeks', tag: 'Serious Commitment'  },
  { weeks: 24, label: '24 Weeks', tag: 'Full Transformation' },
];

const DAYS_PER_WEEK = [
  { days: 3, label: '3 Days / week', desc: 'Beginner friendly'         },
  { days: 4, label: '4 Days / week', desc: 'Balanced approach', hot: true },
  { days: 5, label: '5 Days / week', desc: 'Dedicated athlete'          },
  { days: 6, label: '6 Days / week', desc: 'Elite intensity'            },
];

const DAY_ORDER = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

// ── Date Helpers ──────────────────────────────────────────────────────────────

function getMondayOfWeek(date) {
  const d = new Date(date);
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtShort(date) {
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase();
}

// Day type display helpers — keep in sync with the prompt's day type taxonomy.
// Returns { emoji, label, accentColor } for a given day, used by the day cards
// and detail screen to render circuit-style days (CrossFit / Hyrox) distinctly
// from strength / running days.
function dayTypeMeta(day, colors) {
  if (!day) return null;
  const t = (day.type || '').toLowerCase();
  if (t === 'crossfit')  return { emoji: '⚡', label: 'CrossFit',  accent: '#a855f7', isCircuit: true };
  if (t === 'hyrox')     return { emoji: '🔥', label: 'Hyrox',     accent: '#ef4444', isCircuit: true };
  if (t === 'mobility')  return { emoji: '🧘', label: 'Mobility',  accent: '#22c55e', isCircuit: false };
  if (t === 'run' || t === 'cardio')
                          return { emoji: '🏃', label: 'Cardio',    accent: colors?.green || '#22c55e', isCircuit: false };
  if (t === 'rest')      return { emoji: '😴', label: 'Rest',      accent: colors?.border || '#999', isCircuit: false };
  // Default: strength / workout
  return { emoji: '💪', label: 'Strength', accent: colors?.accent || '#ff6b00', isCircuit: false };
}

// Heuristic detector: is this day a heavy lower-body / leg session?
// Looks at the focus string and exercise muscle/name fields.
function isLegDay(day) {
  if (!day || day.type === 'rest') return false;
  const focus = (day.focus || '').toLowerCase();
  if (/leg|lower|squat|deadlift|glute|quad|hamstring/.test(focus)) return true;
  const exercises = Array.isArray(day.exercises) ? day.exercises : [];
  return exercises.some(ex => {
    const name = (ex?.name || '').toLowerCase();
    const muscle = (ex?.muscle || '').toLowerCase();
    return /squat|deadlift|lunge|leg press|leg curl|leg extension|hip thrust|glute|calf raise/.test(name)
        || /legs|glutes|quads|hamstrings|calves/.test(muscle);
  });
}

// Heuristic detector: is this day a running / cardio session?
function isRunDay(day) {
  if (!day || day.type === 'rest') return false;
  if (day.type === 'run' || day.type === 'cardio') return true;
  const focus = (day.focus || '').toLowerCase();
  return /\brun\b|running|jog|sprint|tempo|interval|long run/.test(focus);
}

// Returns the index + direction of the first ordering conflict in a schedule,
// or null. Considers the schedule cyclic (Sunday → Monday across week boundaries).
//   { idx, kind: 'leg-then-run' }  — heavier guard, running on fatigued legs
//   { idx, kind: 'run-then-leg' }  — softer guard, heavy legs after a hard run
function findOrderingConflict(schedule) {
  if (!Array.isArray(schedule) || schedule.length < 2) return null;
  for (let i = 0; i < schedule.length; i++) {
    const cur = schedule[i];
    const next = schedule[(i + 1) % schedule.length];
    if (isLegDay(cur) && isRunDay(next)) return { idx: i, kind: 'leg-then-run' };
    if (isRunDay(cur) && isLegDay(next)) return { idx: i, kind: 'run-then-leg' };
  }
  return null;
}

// fixOrderingConflicts removed v1.4.0 — only used by the dead callPlanLlm
// path. The hybrid planGenerator builds schedules from hand-curated scaffolds
// so leg↔run adjacency is impossible by construction. findOrderingConflict
// (used by the in-app drag-to-reorder warning) is kept above.

// Local-time YYYY-MM-DD key for the planCompletions store. Using local instead of
// UTC so a workout marked "today" near midnight stays attached to the user's
// calendar day, not UTC's.
function formatDateKey(date) {
  if (!(date instanceof Date) || isNaN(date)) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getCurrentWeekNum(plan) {
  if (!plan?.startDate) return 1;
  const msPerWeek = 1000 * 60 * 60 * 24 * 7;
  const diff = Math.floor((Date.now() - new Date(plan.startDate).getTime()) / msPerWeek);
  return Math.min(Math.max(diff + 1, 1), plan.durationWeeks || 12);
}

function isoDayToDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

// ── Exercise Tutorial Modal ───────────────────────────────────────────────────

function ExerciseTutorialModal({ exName, onClose }) {
  const colors   = useColors();
  const styles   = useMemo(() => makeStyles(colors), [colors]);
  if (!exName) return null;

  const tutorial = getPlanTutorial(exName);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.tutOverlay}>
        <TouchableOpacity style={styles.tutBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.tutSheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.tutHandle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.tutHeader}>
            <View style={[styles.tutEmojiWrap, { backgroundColor: colors.accentDim }]}>
              <Text style={styles.tutEmoji}>{tutorial?.emoji || '💪'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tutTitle, { color: colors.text }]}>{exName}</Text>
              {tutorial && (
                <Text style={[styles.tutSub, { color: colors.text2 }]}>{tutorial.muscles}</Text>
              )}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.tutCloseX, { backgroundColor: colors.bg }]}
            >
              <Text style={[styles.tutCloseXText, { color: colors.text3 }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {tutorial ? (
              <>
                {/* Muscles + Equipment pills */}
                <View style={styles.tutMeta}>
                  <View style={[styles.tutPill, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <Text style={styles.tutPillIcon}>🎯</Text>
                    <Text style={[styles.tutPillText, { color: colors.text2 }]}>{tutorial.muscles}</Text>
                  </View>
                  <View style={[styles.tutPill, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <Text style={styles.tutPillIcon}>🏋️</Text>
                    <Text style={[styles.tutPillText, { color: colors.text2 }]}>{tutorial.equipment}</Text>
                  </View>
                </View>

                {/* Step-by-step */}
                <View style={styles.tutSteps}>
                  <Text style={[styles.tutStepsTitle, { color: colors.text }]}>How to do it</Text>
                  {tutorial.steps.map((step, i) => (
                    <View key={i} style={styles.tutStep}>
                      <View style={[styles.tutStepNum, { backgroundColor: colors.accent }]}>
                        <Text style={styles.tutStepNumText}>{i + 1}</Text>
                      </View>
                      <Text style={[styles.tutStepText, { color: colors.text }]}>{step}</Text>
                    </View>
                  ))}
                </View>

                {/* Pro tip */}
                {tutorial.tip && (
                  <View style={[styles.tutTip, { backgroundColor: colors.accentDim }]}>
                    <Text style={styles.tutTipIcon}>💡</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.tutTipLabel, { color: colors.accent }]}>Pro Tip</Text>
                      <Text style={[styles.tutTipText, { color: colors.text }]}>{tutorial.tip}</Text>
                    </View>
                  </View>
                )}
              </>
            ) : (
              /* No tutorial in DB — show universal form cues + Coach CTA */
              <>
                <View style={styles.tutSteps}>
                  <Text style={[styles.tutStepsTitle, { color: colors.text }]}>General form cues</Text>
                  {[
                    'Warm up the working muscles before starting your first heavy set.',
                    'Move through a full range of motion — quality reps over quantity.',
                    'Control the eccentric (lowering) phase — about 2 seconds down, 1 second up.',
                    'Breathe out on the exertion (the hard part), in on the return.',
                    'Rest 60–90 seconds between sets for hypertrophy, 2–3 minutes for strength.',
                  ].map((step, i) => (
                    <View key={i} style={styles.tutStep}>
                      <View style={[styles.tutStepNum, { backgroundColor: colors.accent }]}>
                        <Text style={styles.tutStepNumText}>{i + 1}</Text>
                      </View>
                      <Text style={[styles.tutStepText, { color: colors.text }]}>{step}</Text>
                    </View>
                  ))}
                </View>
                <View style={[styles.tutTip, { backgroundColor: colors.accentDim }]}>
                  <Text style={styles.tutTipIcon}>💡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tutTipLabel, { color: colors.accent }]}>Want a deeper breakdown?</Text>
                    <Text style={[styles.tutTipText, { color: colors.text }]}>
                      Open the AI Coach tab and ask: "How do I do {exName}?" — you'll get step-by-step instructions tailored to your level.
                    </Text>
                  </View>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.tutCloseBtn, { backgroundColor: colors.accent }]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.tutCloseBtnText}>Got it</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Full-screen Workout Detail View ──────────────────────────────────────────
// Replaces the whole screen — no Modal issues on Android

function WorkoutDetailScreen({ workout, dayDate, weekNum, totalWeeks, useLlmProgression = false, progressionNote = null, onStart }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [tutorialEx, setTutorialEx] = useState(null); // exercise name string

  if (!workout) return null;

  const isRest       = workout.type === 'rest';
  const isCardio     = workout.type === 'cardio' || workout.type === 'run';
  const isCoachItem  = !!workout.isCoachItem;
  // v1.1.0 — circuit-style days (CrossFit / Hyrox) render exercises as a
  // movement list with reps only (no sets), under a prominent "format" header.
  const dayMeta      = dayTypeMeta(workout, colors);
  const isCircuit    = !!dayMeta?.isCircuit;
  const isMobility   = workout.type === 'mobility';
  const phase        = (weekNum && totalWeeks) ? getPhase(weekNum, totalWeeks) : null;
  const accentCol    = isCardio ? colors.green : (dayMeta?.accent || colors.accent);
  const baseExercises = workout.exercises || [];
  // v1.1.0+ plans: the LLM provides phase-specific exercises with the right
  // sets/reps already, so skip the mechanical progression. Legacy plans (no
  // phases array) still get the old +set/+rep bump per Build/Peak phase.
  // Circuit days also skip mechanical progression (their structure is fixed
  // by the format, not adjustable via "+1 set in Build phase").
  const exercises    = (phase && !isCardio && !isCircuit && !isCoachItem && !useLlmProgression)
    ? applyProgression(baseExercises, phase)
    : baseExercises;
  const dateLabel    = dayDate
    ? dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : workout.day || '';
  const estMins = isCoachItem
    ? (workout.duration || 30)
    : exercises.length > 0 ? exercises.length * 8 : 30;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* ── Accent top bar ── */}
      <View style={[styles.dsAccentBar, { backgroundColor: accentCol }]} />

      {/* ── Scrollable content ── */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.dsScroll}
      >
        {/* Header */}
        <Text style={[styles.dsDate, { color: colors.text3 }]}>{dateLabel.toUpperCase()}</Text>
        <Text style={[styles.dsTitle, { color: colors.text }]}>
          {isRest ? 'Rest & Recovery' : (workout.focus || workout.title || 'Workout')}
        </Text>

        {/* Pills row */}
        <View style={styles.dsPillRow}>
          {!isRest && (
            <View style={[styles.dsPill, { backgroundColor: accentCol + '22', borderColor: accentCol + '55' }]}>
              <Text style={[styles.dsPillText, { color: accentCol }]}>
                {isCoachItem ? '✨ Coach' : `${dayMeta?.emoji || '💪'} ${dayMeta?.label || 'Strength'}`}
              </Text>
            </View>
          )}
          {!isRest && !!workout.format && (
            <View style={[styles.dsPill, { backgroundColor: accentCol + '12', borderColor: accentCol + '44' }]}>
              <Text style={[styles.dsPillText, { color: accentCol, fontWeight: '800' }]}>{workout.format}</Text>
            </View>
          )}
          {!isRest && exercises.length > 0 && (
            <View style={[styles.dsPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.dsPillText, { color: colors.text2 }]}>
                {exercises.length} {isCircuit ? 'movements' : 'exercises'}
              </Text>
            </View>
          )}
          {!isRest && (
            <View style={[styles.dsPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.dsPillText, { color: colors.text2 }]}>~{estMins} min</Text>
            </View>
          )}
        </View>

        {/* ── REST DAY ── */}
        {isRest ? (
          <View style={styles.dsRestBox}>
            <Text style={{ fontSize: 56, marginBottom: 16 }}>😴</Text>
            <Text style={[styles.dsRestTitle, { color: colors.text }]}>You've earned this</Text>
            <Text style={[styles.dsRestSub, { color: colors.text2 }]}>
              Muscles grow during recovery, not during the workout. Use today wisely.
            </Text>
            <View style={[styles.dsRestTipsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {[
                { icon: '💧', tip: 'Stay hydrated throughout the day' },
                { icon: '🧘', tip: 'Light stretching or yoga' },
                { icon: '😴', tip: 'Aim for 7–9 hours of sleep' },
                { icon: '🥩', tip: 'Keep protein intake high' },
                { icon: '🚶', tip: 'A short walk is totally fine' },
              ].map((item, i) => (
                <View
                  key={i}
                  style={[
                    styles.dsRestTipRow,
                    { borderTopColor: colors.border },
                    i === 0 && { borderTopWidth: 0 },
                  ]}
                >
                  <Text style={styles.dsRestTipIcon}>{item.icon}</Text>
                  <Text style={[styles.dsRestTipText, { color: colors.text2 }]}>{item.tip}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : isCoachItem ? (
          /* ── COACH-SCHEDULED WORKOUT (no exercise breakdown) ── */
          <View style={styles.dsRestBox}>
            <Text style={{ fontSize: 52, marginBottom: 16 }}>✨</Text>
            <Text style={[styles.dsRestTitle, { color: colors.text }]}>Coach Scheduled</Text>
            <Text style={[styles.dsRestSub, { color: colors.text2 }]}>
              Your coach added this session. Hit Start Workout to log your exercises and track your progress.
            </Text>
            <View style={[styles.dsRestTipsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {[
                { icon: '⏱', tip: `Estimated duration: ${estMins} minutes` },
                { icon: '💪', tip: 'Choose your own exercises or follow your coach\'s advice' },
                { icon: '📝', tip: 'All sets and reps will be tracked automatically' },
                { icon: '🔥', tip: 'Stay consistent — every session counts' },
              ].map((item, i) => (
                <View
                  key={i}
                  style={[
                    styles.dsRestTipRow,
                    { borderTopColor: colors.border },
                    i === 0 && { borderTopWidth: 0 },
                  ]}
                >
                  <Text style={styles.dsRestTipIcon}>{item.icon}</Text>
                  <Text style={[styles.dsRestTipText, { color: colors.text2 }]}>{item.tip}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          /* ── PLAN WORKOUT EXERCISES ── */
          <View style={styles.dsExSection}>
            {/* Progressive overload guidance — LLM-provided per-week note for v1.1.0+
                plans, or the legacy mechanical tip for older plans. */}
            {phase && !isCardio && (
              <View style={[styles.phaseBox, { backgroundColor: phase.color + '15', borderColor: phase.color + '44' }]}>
                <View style={[styles.phaseDot, { backgroundColor: phase.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.phaseBoxLabel, { color: phase.color }]}>
                    Week {weekNum}{progressionNote ? '' : ` — ${phase.label} Phase`}
                  </Text>
                  <Text style={[styles.phaseBoxTip, { color: colors.text2 }]}>
                    {progressionNote || phase.tip}
                  </Text>
                </View>
              </View>
            )}
            <Text style={[styles.dsExSectionLabel, { color: colors.text3 }]}>
              {isCircuit ? 'MOVEMENTS' : 'EXERCISES'}
            </Text>
            {/* Circuit-day banner: explicit instruction so the user knows how to read the list */}
            {isCircuit && (
              <View style={[styles.phaseBox, { backgroundColor: accentCol + '12', borderColor: accentCol + '44', marginBottom: 14 }]}>
                <View style={[styles.phaseDot, { backgroundColor: accentCol }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.phaseBoxLabel, { color: accentCol }]}>{workout.format || 'Circuit'}</Text>
                  <Text style={[styles.phaseBoxTip, { color: colors.text2 }]}>
                    {workout.type === 'crossfit'
                      ? 'Complete all movements in order, then repeat for the duration / round count above.'
                      : 'Move through each station in sequence with minimal rest. Hyrox-style functional fitness.'}
                  </Text>
                </View>
              </View>
            )}
            {exercises.map((ex, i) => {
              // Build chips list dynamically based on what fields the exercise actually has.
              // Strength typically has sets/reps/rest; circuit has reps or distance/weight;
              // mobility has duration. We only render chips for present fields.
              const chips = [];
              if (ex.sets != null && !isCircuit)         chips.push(['SETS',     String(ex.sets)]);
              if (ex.reps != null)                       chips.push(['REPS',     String(ex.reps)]);
              if (ex.distance != null)                   chips.push(['DISTANCE', String(ex.distance)]);
              if (ex.weight   != null)                   chips.push(['WEIGHT',   String(ex.weight)]);
              if (ex.duration != null)                   chips.push(['DURATION', String(ex.duration)]);
              if (ex.pace     != null)                   chips.push(['PACE',     String(ex.pace)]);
              if (ex.rest     != null && !isCircuit)     chips.push(['REST',     String(ex.rest)]);
              return (
                <View
                  key={i}
                  style={[styles.dsExCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.dsExNum, { backgroundColor: accentCol + '22' }]}>
                    <Text style={[styles.dsExNumText, { color: accentCol }]}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.dsExNameRow}>
                      <Text style={[styles.dsExName, { color: colors.text, flex: 1 }]}>{ex.name}</Text>
                      <TouchableOpacity
                        style={[styles.dsInfoBtn, { backgroundColor: accentCol + '18', borderColor: accentCol + '44' }]}
                        onPress={() => setTutorialEx(ex.name)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dsInfoBtnText, { color: accentCol }]}>ⓘ</Text>
                      </TouchableOpacity>
                    </View>
                    {chips.length > 0 && (
                      <View style={styles.dsChipRow}>
                        {chips.map(([label, value], j) => (
                          <View key={j} style={[styles.dsChip, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                            <Text style={[styles.dsChipLabel, { color: colors.text3 }]}>{label}</Text>
                            <Text style={[styles.dsChipVal, { color: colors.text }]}>{value}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── Start Workout button (workout days + coach items) ── */}
      {!isRest && (
        <View style={[styles.dsFooter, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.dsStartBtn, { backgroundColor: accentCol }]}
            onPress={() => {
              // Build a routine object the Workout tab can consume.
              // Strength days get the progression-applied exercises so the user
              // actually lifts the right sets/reps for their current phase.
              // Circuit days (CrossFit / Hyrox) and mobility don't fit the strength
              // tracker — for v1.1.0 we treat them as cardio-style timer sessions
              // so the user gets a stopwatch + the movement list to follow.
              const routineType = isCardio || isCircuit || isMobility
                ? 'cardio'
                : 'strength';
              const routine = {
                name: workout.name || workout.focus || 'Workout',
                exercises,
                duration: estMins,
                type: routineType,
                format: workout.format || null,
                dayType: workout.type || null,
                color: accentCol,
                generated: !!workout.generated,
              };
              onStart(routine);
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.dsStartBtnText}>▶  Start Workout</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Exercise tutorial modal ── */}
      {tutorialEx && (
        <ExerciseTutorialModal
          exName={tutorialEx}
          onClose={() => setTutorialEx(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ── Create Plan Wizard ────────────────────────────────────────────────────────

function CreatePlanModal({ visible, onClose, onCreated }) {
  const colors   = useColors();
  const { user } = useStore();
  const styles   = useMemo(() => makeStyles(colors), [colors]);
  const insets   = useSafeAreaInsets();

  const [step, setStep]           = useState(0);
  const [goal, setGoal]           = useState(null);
  const [duration, setDuration]   = useState(12);
  const [daysPerWk, setDaysPerWk] = useState(4);
  const [currentCap, setCurrentCap] = useState('');

  const meta      = user?.user_metadata || {};
  const level     = meta.level      || user?.level      || 'Beginner';
  const equipment = (meta.equipment || ['No equipment']).join(', ');
  const styles_   = (meta.styles    || []).join(', ') || 'general fitness';
  const ageGroup  = meta.ageGroup   || 'unknown';
  const userGoals = (meta.goals     || []).join(', ') || 'general fitness';
  const firstName = (meta.full_name || user?.name || 'Athlete').split(' ')[0];

  const reset = () => { setStep(0); setGoal(null); setDuration(12); setDaysPerWk(4); setCurrentCap(''); };

  // Goal-aware placeholder for the "current capability" step
  const capabilityPlaceholder = (() => {
    if (!goal) return 'e.g. "I bench 60kg for 5 reps and run 5km in 30 min"';
    const g = goal.toLowerCase();
    if (g.includes('marathon') || g.includes('5k') || g.includes('10k') || g.includes('half'))
      return 'e.g. "Last 5K was 28:00. Currently running 25 km/week, longest run 8 km."';
    if (g.includes('strong') || g.includes('muscle') || g.includes('lift'))
      return 'e.g. "Bench 70kg x 5, Squat 90kg x 5, Deadlift 110kg x 3"';
    if (g.includes('endurance'))
      return 'e.g. "Can hold 6:00/km pace for 5 km. Cycling 30 min @ moderate effort."';
    if (g.includes('athletic'))
      return 'e.g. "Vertical jump 60cm, 40-yd dash 5.0s, 5-rep max bench 80kg"';
    return 'e.g. "Workout 3x/week. Comfortable with 30-minute sessions. 5 push-ups in a row."';
  })();
  const close = () => { reset(); onClose(); };


  const generate = async () => {
    setStep(4);
    let lastErr = null;
    // Hybrid template generator (planGenerator.js). The monolithic LLM
    // callPlanLlm + buildPrompt was deleted in v1.4.0 (~310 lines of dead
    // code that hadn't been called since v1.3.0).
    const goalEntry = GOALS.find(g => g.label === goal);
    const goalId    = goalEntry?.id || null;
    const rawEquipment = Array.isArray(meta.equipment) ? meta.equipment : [];

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const plan = await generatePlan({
          goal, goalId, duration, daysPerWeek: daysPerWk,
          level: (level || '').toLowerCase(),
          equipment: rawEquipment,
          firstName,
        });
        onCreated(plan);
        close();
        return;
      } catch (err) {
        lastErr = err;
        // Retry only on transient LLM failures (the coach-note call). Missing
        // scaffold or other deterministic errors should fail fast.
        const msg = err?.message || '';
        const isTransient =
          msg.includes('JSON') ||
          msg.includes('Empty response') ||
          msg.includes('Edge function error') ||
          msg.includes('timeout');
        if (!isTransient) break;
      }
    }
    Alert.alert('Error generating plan', lastErr?.message || 'Try again');
    setStep(3);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={close} />
        <View style={[
          styles.modalSheet,
          { backgroundColor: colors.surface,
            // Replace the fixed 40px bottom padding with the device's actual
            // bottom inset so the Next/Generate buttons clear the gesture
            // nav bar on all phones.
            paddingBottom: Math.max(20, insets.bottom + 12) },
        ]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

          {step === 4 ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingTitle, { color: colors.text }]}>Building your plan…</Text>
              <Text style={[styles.loadingSub, { color: colors.text2 }]}>
                Your AI coach is crafting a personalised {duration}-week programme
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.stepRow}>
                {[0,1,2,3].map(i => (
                  <View key={i} style={[styles.stepDot, { backgroundColor: i <= step ? colors.accent : colors.border }]} />
                ))}
              </View>

              {step === 0 && (
                <>
                  <Text style={[styles.wizardTitle, { color: colors.text }]}>What's your main goal?</Text>
                  <Text style={[styles.wizardSub, { color: colors.text2 }]}>Your plan will be built around this</Text>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                    {/* Only show goals that actually have a plan scaffold — the
                        user should never pick a goal then hit a dead end. */}
                    {GOALS.filter(g => goalHasAnyScaffold(g.id)).map(g => (
                      <TouchableOpacity
                        key={g.id}
                        style={[styles.optionCard, { backgroundColor: colors.bg, borderColor: colors.border },
                          goal === g.label && { borderColor: colors.accent, backgroundColor: colors.accentDim }]}
                        onPress={() => setGoal(g.label)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.optionIcon}>{g.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.optionLabel, { color: colors.text }, goal === g.label && { color: colors.accent }]}>{g.label}</Text>
                          <Text style={[styles.optionDesc, { color: colors.text3 }]}>{g.desc}</Text>
                        </View>
                        {goal === g.label && <Text style={{ color: colors.accent, fontSize: 18 }}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity
                    style={[styles.wizardBtn, { backgroundColor: colors.accent }, !goal && { opacity: 0.4 }]}
                    onPress={() => goal && setStep(1)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.wizardBtnText}>Next →</Text>
                  </TouchableOpacity>
                </>
              )}

              {step === 1 && (
                <>
                  <Text style={[styles.wizardTitle, { color: colors.text }]}>How long is your commitment?</Text>
                  <Text style={[styles.wizardSub, { color: colors.text2 }]}>Longer plans deliver better results</Text>
                  <View style={{ gap: 10, marginBottom: 20 }}>
                    {DURATIONS.map(d => (
                      <TouchableOpacity
                        key={d.weeks}
                        style={[styles.durationCard, { backgroundColor: colors.bg, borderColor: colors.border },
                          duration === d.weeks && { borderColor: colors.accent, backgroundColor: colors.accentDim }]}
                        onPress={() => setDuration(d.weeks)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.durationLabel, { color: colors.text }, duration === d.weeks && { color: colors.accent }]}>{d.label}</Text>
                          <Text style={[styles.durationTag, { color: colors.text3 }]}>{d.tag}</Text>
                        </View>
                        {d.hot && <View style={[styles.hotBadge, { backgroundColor: colors.accent }]}><Text style={styles.hotText}>Popular</Text></View>}
                        {duration === d.weeks && <Text style={{ color: colors.accent, fontSize: 18, marginLeft: 8 }}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={[styles.wizardBtn, styles.wizardBtnBack, { borderColor: colors.border }]} onPress={() => setStep(0)} activeOpacity={0.7}>
                      <Text style={[styles.wizardBtnText, { color: colors.text2 }]}>← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.wizardBtn, { backgroundColor: colors.accent, flex: 1 }]} onPress={() => setStep(2)} activeOpacity={0.85}>
                      <Text style={styles.wizardBtnText}>Next →</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {step === 2 && (
                <>
                  <Text style={[styles.wizardTitle, { color: colors.text }]}>Days per week?</Text>
                  <Text style={[styles.wizardSub, { color: colors.text2 }]}>Be realistic — consistency beats intensity</Text>
                  <View style={{ gap: 10, marginBottom: 20 }}>
                    {DAYS_PER_WEEK.map(d => (
                      <TouchableOpacity
                        key={d.days}
                        style={[styles.durationCard, { backgroundColor: colors.bg, borderColor: colors.border },
                          daysPerWk === d.days && { borderColor: colors.accent, backgroundColor: colors.accentDim }]}
                        onPress={() => setDaysPerWk(d.days)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.durationLabel, { color: colors.text }, daysPerWk === d.days && { color: colors.accent }]}>{d.label}</Text>
                          <Text style={[styles.durationTag, { color: colors.text3 }]}>{d.desc}</Text>
                        </View>
                        {d.hot && <View style={[styles.hotBadge, { backgroundColor: colors.accent }]}><Text style={styles.hotText}>Recommended</Text></View>}
                        {daysPerWk === d.days && <Text style={{ color: colors.accent, fontSize: 18, marginLeft: 8 }}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={[styles.wizardBtn, styles.wizardBtnBack, { borderColor: colors.border }]} onPress={() => setStep(1)} activeOpacity={0.7}>
                      <Text style={[styles.wizardBtnText, { color: colors.text2 }]}>← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.wizardBtn, { backgroundColor: colors.accent, flex: 1 }]} onPress={() => setStep(3)} activeOpacity={0.85}>
                      <Text style={styles.wizardBtnText}>Next →</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {step === 3 && (
                <>
                  <Text style={[styles.wizardTitle, { color: colors.text }]}>Where are you starting from?</Text>
                  <Text style={[styles.wizardSub, { color: colors.text2 }]}>
                    Optional — tell us your current numbers so the plan starts at the right level. Leave blank to use your fitness level.
                  </Text>
                  <TextInput
                    style={[styles.capabilityInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                    placeholder={capabilityPlaceholder}
                    placeholderTextColor={colors.text3}
                    value={currentCap}
                    onChangeText={setCurrentCap}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    maxLength={400}
                  />
                  <Text style={[styles.capabilityHint, { color: colors.text3 }]}>
                    {currentCap.length}/400 · The more specific, the better your plan progression.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                    <TouchableOpacity style={[styles.wizardBtn, styles.wizardBtnBack, { borderColor: colors.border }]} onPress={() => setStep(2)} activeOpacity={0.7}>
                      <Text style={[styles.wizardBtnText, { color: colors.text2 }]}>← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.wizardBtn, { backgroundColor: colors.accent, flex: 1 }]} onPress={generate} activeOpacity={0.85}>
                      <Text style={styles.wizardBtnText}>Generate My Plan ✨</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Workout Day Row Card (Runna-style) ────────────────────────────────────────

function WorkoutDayCard({ dayData, dayDate, onPress }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { planCompletions, togglePlanCompletion } = useStore();

  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const isToday = dayDate?.toDateString() === today.toDateString();
  const isRest  = dayData.type === 'rest';

  // User-controlled completion state — date string keyed by local YYYY-MM-DD.
  const dateKey = dayDate ? formatDateKey(dayDate) : null;
  const isCompleted = !!(dateKey && planCompletions?.[dateKey]);

  const stripeCol = isCompleted && !isRest ? colors.green
                  : dayData.type === 'cardio' ? colors.green
                  : dayData.type === 'rest'   ? colors.border
                  : colors.accent;

  const borderCol = isToday ? colors.accent : colors.border;
  const dateLabel = dayDate
    ? dayDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })
    : dayData.day;
  const estMins = (dayData.exercises?.length || 0) * 8 || 30;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{ marginBottom: 10, borderRadius: 16 }}
    >
      <View style={[
        styles.wdCard,
        { backgroundColor: colors.surface, borderColor: borderCol },
        // borderWidth is always 2 so the layout doesn't shift when 'Today'
        // gets its accent border — previously the 1px → 2px swap made the
        // active card 1px taller/wider than its neighbours.
      ]}>
        {/* Colored left stripe */}
        <View style={[styles.wdStripe, { backgroundColor: stripeCol }]} />

        <View style={styles.wdBody}>
          {/* Top row: date + tappable checkbox */}
          <View style={styles.wdTopRow}>
            <Text style={[styles.wdDate, { color: isToday ? colors.accent : colors.text3 }]}>
              {dateLabel}{!isRest ? ` · ~${estMins}m` : ''}
            </Text>
            {!isRest && (
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); dateKey && togglePlanCompletion(dateKey); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
                style={[
                  styles.wdCheck,
                  { borderColor: isCompleted ? colors.green : colors.border },
                  isCompleted && { backgroundColor: colors.green },
                ]}
              >
                {isCompleted && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>✓</Text>}
              </TouchableOpacity>
            )}
          </View>

          {/* Title */}
          <Text style={[styles.wdTitle, { color: isRest ? colors.text3 : colors.text }]}>
            {isRest ? 'Rest Day' : dayData.focus || 'Workout'}
          </Text>

          {/* Bottom row */}
          {!isRest && (() => {
            const meta = dayTypeMeta(dayData, colors);
            const exCount = dayData.exercises?.length || 0;
            const exLabel = meta?.isCircuit ? 'movements' : 'exercises';
            return (
              <View style={styles.wdBottomRow}>
                <Text style={[styles.wdType, { color: meta?.accent || colors.text3 }]}>
                  {meta?.emoji} {meta?.label}
                </Text>
                {!!dayData.format && (
                  <Text style={[styles.wdExCount, { color: colors.text3 }]}>
                    {' '}· {dayData.format}
                  </Text>
                )}
                {exCount > 0 && !dayData.format && (
                  <Text style={[styles.wdExCount, { color: colors.text3 }]}>
                    {' '}· {exCount} {exLabel}
                  </Text>
                )}
                {isToday && (
                  <View style={[styles.todayPill, { backgroundColor: colors.accent, marginLeft: 8 }]}>
                    <Text style={styles.todayPillText}>Today</Text>
                  </View>
                )}
              </View>
            );
          })()}

          {/* Tap hint arrow */}
          <Text style={[styles.wdArrow, { color: colors.text3 }]}>›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Coach Schedule Card (from AI Coach tab) ───────────────────────────────────

function CoachScheduleCard({ scheduledWorkouts, onOpenWorkout }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(true);

  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const sorted    = [...scheduledWorkouts].sort((a, b) => a.date.localeCompare(b.date));
  const doneCount = sorted.filter(w => isoDayToDate(w.date) < today).length;
  const progress  = sorted.length > 0 ? doneCount / sorted.length : 0;

  return (
    <View style={[styles.coachSchedCard, { backgroundColor: colors.surface, borderColor: colors.accent + '44' }]}>
      {/* Header */}
      <TouchableOpacity style={styles.coachSchedHeader} onPress={() => setExpanded(e => !e)} activeOpacity={0.8}>
        <View style={[styles.coachSchedIcon, { backgroundColor: colors.accent + '18' }]}>
          <Text style={{ fontSize: 18 }}>✨</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.coachSchedTitle, { color: colors.text }]}>Coach Plan</Text>
          <Text style={[styles.coachSchedSub, { color: colors.text3 }]}>{doneCount}/{sorted.length} workouts done</Text>
        </View>
        <Text style={[styles.weekChevron, { color: colors.text3 }]}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Progress bar */}
      <View style={[styles.weekProgressBg, { backgroundColor: colors.border }]}>
        <View style={[styles.weekProgressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.accent }]} />
      </View>

      {/* Tappable workout day cards — same style as plan WeekCard */}
      {expanded && (
        <View style={{ marginTop: 14 }}>
          {sorted.map((w, i) => {
            const wDate = isoDayToDate(w.date);
            // Convert coach schedule item → dayData format for WorkoutDayCard + detail screen
            const dayData = {
              type:          'workout',
              focus:         w.title,
              exercises:     [],
              duration:      w.duration,
              isCoachItem:   true,
            };
            return (
              <WorkoutDayCard
                key={w.id || i}
                dayData={dayData}
                dayDate={wDate}
                onPress={() => onOpenWorkout(dayData, wDate)}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Week Card ─────────────────────────────────────────────────────────────────

// Color palette mapped to common phase names (matches LLM output naming).
// Defaults to a neutral gray for unrecognized phase names.
const PHASE_COLORS = {
  foundation:  '#3b82f6',
  base:        '#3b82f6',
  build:       '#f59e0b',
  threshold:   '#f59e0b',
  tempo:       '#f59e0b',
  speed:       '#f59e0b',
  peak:        '#ef4444',
  race:        '#ef4444',
  taper:       '#22c55e',
  deload:      '#22c55e',
  recovery:    '#22c55e',
  specialization: '#a855f7',
};
function colorForPhaseName(name) {
  if (!name) return '#64748b';
  const k = name.toLowerCase().split(/\s|&|\//)[0];
  return PHASE_COLORS[k] || '#64748b';
}

// LEGACY fallback: if a plan was generated before v1.1.0 (no `phases`), compute
// a coarse phase label from the % position in the program. Replaced by the
// LLM-provided phases when available.
function getPhase(weekNum, totalWeeks) {
  const pct = weekNum / totalWeeks;
  if (pct <= 0.33) return { label: 'Foundation', color: '#3b82f6', tip: 'Build your base — master form before adding load' };
  if (pct <= 0.66) return { label: 'Build',       color: '#f59e0b', tip: 'Volume increases this phase — +1 set per exercise vs Foundation' };
  return               { label: 'Peak',        color: '#ef4444', tip: 'Maximum effort — sets and reps at their highest point' };
}

// LEGACY fallback: mechanical progression for old plans without LLM-provided
// per-week progression notes. Replaced by phase rotation in v1.1.0+.
function applyProgression(exercises, phase) {
  if (!exercises?.length || phase.label === 'Foundation') return exercises;
  return exercises.map(ex => {
    const baseSets = typeof ex.sets === 'number' ? ex.sets : 3;
    const sets = phase.label === 'Build'
      ? Math.min(baseSets + 1, 5)
      : Math.min(baseSets + 2, 6); // Peak
    let reps = ex.reps || '10';
    if (phase.label === 'Peak' && typeof reps === 'string') {
      reps = reps.replace(/\d+/g, n => String(Math.min(parseInt(n) + 2, 30)));
    }
    return { ...ex, sets, reps };
  });
}

// ── v1.1.0 phase helpers ─────────────────────────────────────────────────────
// Plans generated v1.1.0+ include a `phases` array with per-phase schedules and
// per-week progression notes. These helpers expose that data; they fall back to
// legacy fields for plans created before v1.1.0.

// Find the phase that contains a given week. Returns null if no phases array
// (caller can fall back to legacy `getPhase`).
function getPhaseForWeek(plan, weekNum) {
  if (!plan?.phases?.length) return null;
  return (
    plan.phases.find(p => weekNum >= (p.startWeek || 1) && weekNum <= (p.endWeek || 1))
    || plan.phases[plan.phases.length - 1]   // beyond last phase: clamp to last
  );
}

// Schedule (Mon-Sun) for the given week — rotates through scheduleVariants if
// the phase provides them (week 1 = variant 0, week 2 = variant 1, week 3 = variant 0, ...),
// falls back to phase.schedule (single-variant pre-fix), then plan.weeklySchedule.
function getScheduleForWeek(plan, weekNum) {
  const phase = getPhaseForWeek(plan, weekNum);
  if (phase?.scheduleVariants?.length) {
    const idxInPhase = weekNum - (phase.startWeek || 1);
    const variantIdx = ((idxInPhase % phase.scheduleVariants.length) + phase.scheduleVariants.length) % phase.scheduleVariants.length;
    const variant = phase.scheduleVariants[variantIdx];
    if (Array.isArray(variant?.schedule) && variant.schedule.length > 0) return variant.schedule;
  }
  if (Array.isArray(phase?.schedule) && phase.schedule.length > 0) return phase.schedule;
  return Array.isArray(plan?.weeklySchedule) ? plan.weeklySchedule : [];
}

// Per-week progression note from the LLM. Returns null if no note for this week
// (legacy plans, or weeks outside any phase).
function getProgressionNoteForWeek(plan, weekNum) {
  const phase = getPhaseForWeek(plan, weekNum);
  if (!phase || !Array.isArray(phase.weekProgressions)) return null;
  const idxInPhase = weekNum - (phase.startWeek || 1);
  return phase.weekProgressions[idxInPhase] || null;
}

// Per-week progression tags (small badge strings like "+1 rep", "Tempo added").
// Returns [] if the LLM didn't provide them or this is a legacy plan.
function getProgressionTagsForWeek(plan, weekNum) {
  const phase = getPhaseForWeek(plan, weekNum);
  if (!phase || !Array.isArray(phase.progressionTagsByWeek)) return [];
  const idxInPhase = weekNum - (phase.startWeek || 1);
  const tags = phase.progressionTagsByWeek[idxInPhase];
  return Array.isArray(tags) ? tags.filter(t => typeof t === 'string' && t.trim()) : [];
}

function WeekCard({ weekNum, plan, currentWeekNum, onOpenWorkout, onReorder, onDragActive }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const isCurrent   = weekNum === currentWeekNum;
  const [expanded, setExpanded] = useState(isCurrent);
  const { planCompletions } = useStore();

  // v1.1.0+ plans: use LLM-provided phase data. Legacy plans fall back to getPhase().
  const llmPhase = getPhaseForWeek(plan, weekNum);
  const phase = llmPhase
    ? { label: llmPhase.name || 'Phase', color: colorForPhaseName(llmPhase.name), focus: llmPhase.focus }
    : getPhase(weekNum, plan.durationWeeks || 12);
  const progressionNote = getProgressionNoteForWeek(plan, weekNum);
  const progressionTags = getProgressionTagsForWeek(plan, weekNum);

  // Plan weeks start on the day the user generated the plan (not the previous
  // Monday). Week 1 = generation day, Week 2 = +7 days, etc. The schedule's
  // "Monday/Tuesday/..." labels are just sequence markers — the actual day-of-week
  // shown to the user comes from dayDate.
  const planStart = new Date(plan.startDate);
  planStart.setHours(0, 0, 0, 0);
  const weekStart = addDays(planStart, (weekNum - 1) * 7);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd   = addDays(weekStart, 6);
  const today     = new Date(); today.setHours(0, 0, 0, 0);

  // v1.1.0: pull phase-specific schedule when phases are present (so each phase
  // has different exercises). Falls back to plan.weeklySchedule for legacy plans.
  const schedule      = getScheduleForWeek(plan, weekNum);
  const workoutDays   = schedule.filter(d => d.type !== 'rest');
  const estimatedMins = workoutDays.reduce((s, d) => s + (d.exercises?.length || 0) * 8, 0) || workoutDays.length * 30;

  // Map each workout day to its actual calendar date key for completion lookup.
  const workoutDateKeys = schedule
    .map((d, i) => ({ d, dateKey: formatDateKey(addDays(weekStart, i)) }))
    .filter(({ d }) => d.type !== 'rest')
    .map(({ dateKey }) => dateKey);

  // Week-level "completed" flag is now derived from user-marked day completions
  // (not from calendar date). A week is complete when every workout day in it
  // has been ticked off by the user.
  const completedCount = workoutDateKeys.filter(k => planCompletions?.[k]).length;
  const weekProgress   = workoutDateKeys.length > 0
    ? completedCount / workoutDateKeys.length
    : 0;
  const isCompleted = workoutDateKeys.length > 0 && completedCount === workoutDateKeys.length;

  return (
    <View style={[
      styles.weekCard,
      { backgroundColor: colors.surface, borderColor: colors.border },
      isCurrent   && { borderColor: colors.accent, borderWidth: 2 },
      isCompleted && { opacity: 0.75 },
    ]}>
      {/* Week header */}
      <TouchableOpacity
        style={styles.weekCardHeader}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.8}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.weekDateRange, { color: colors.text3 }]}>{fmtShort(weekStart)} – {fmtShort(weekEnd)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <Text style={[styles.weekTitle, { color: isCurrent ? colors.accent : colors.text }]}>
              Week {weekNum}
            </Text>
            {isCurrent && (
              <View style={[styles.currentBadge, { backgroundColor: colors.accent }]}>
                <Text style={styles.currentBadgeText}>CURRENT</Text>
              </View>
            )}
          </View>
        </View>
        {isCompleted ? (
          <View style={[styles.completedCheck, { backgroundColor: colors.green }]}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>✓</Text>
          </View>
        ) : (
          <Text style={[styles.weekChevron, { color: colors.text3 }]}>{expanded ? '▲' : '▼'}</Text>
        )}
      </TouchableOpacity>

      {/* Progress bar */}
      <View style={[styles.weekProgressBg, { backgroundColor: colors.border }]}>
        <View style={[styles.weekProgressFill, {
          width: `${Math.round(weekProgress * 100)}%`,
          backgroundColor: isCompleted ? colors.green : colors.accent,
        }]} />
      </View>

      {/* Stats + phase row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[styles.weekStats, { color: colors.text3 }]}>
          {workoutDays.length} workouts · ~{estimatedMins} min
        </Text>
        <View style={[styles.phaseBadge, { backgroundColor: phase.color + '18', borderColor: phase.color + '44' }]}>
          <Text style={[styles.phaseBadgeText, { color: phase.color }]}>{phase.label}</Text>
        </View>
      </View>

      {/* Expanded: progression note (if LLM provided one for this week) + draggable day cards */}
      {expanded && (
        <>
          {!!progressionNote && (
            <View style={[styles.progressionNote, { backgroundColor: phase.color + '14', borderColor: phase.color + '44' }]}>
              <Text style={[styles.progressionNoteLabel, { color: phase.color }]}>This Week</Text>
              <Text style={[styles.progressionNoteText, { color: colors.text }]}>{progressionNote}</Text>
              {progressionTags.length > 0 && (
                <View style={styles.progressionTagRow}>
                  {progressionTags.map((tag, i) => (
                    <View key={i} style={[styles.progressionTag, { backgroundColor: phase.color + '22', borderColor: phase.color + '66' }]}>
                      <Text style={[styles.progressionTagText, { color: phase.color }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
          <DraggableWorkoutDayList
            key={(schedule || []).map(d => d.day + d.type + d.focus).join('|')}
            schedule={schedule}
            weekStart={weekStart}
            weekNum={weekNum}
            colors={colors}
            onReorder={onReorder}
            onDragActive={onDragActive}
            onOpenWorkout={onOpenWorkout}
          />
        </>
      )}
    </View>
  );
}

// ── Drag-to-Reorder Workout Day List (used inside each expanded WeekCard) ────
// Shows the rich WorkoutDayCard with a ≡ handle on the right — hold and drag to
// reorder the week's day types. Because weeklySchedule is one shared template,
// reordering here propagates across all weeks.

function DraggableWorkoutDayList({ schedule, weekStart, weekNum, colors, onReorder, onDragActive, onOpenWorkout }) {
  const styles      = useMemo(() => makeStyles(colors), [colors]);
  const ITEM_H      = 108; // WorkoutDayCard height + marginBottom
  const HOLD_MS     = 500; // how long the user must press-and-hold before drag arms
  const MOVE_CANCEL = 8;   // px of finger movement during hold that cancels the long-press
  const n           = schedule.length;

  const [order, setOrder]          = useState(() => schedule.map((_, i) => i));
  const [activeOrigIdx, setActive] = useState(-1);

  const orderRef        = useRef(order);
  const dragAnim        = useRef(new Animated.Value(0)).current;
  const dragStartPosRef = useRef(-1);
  const dragCurrPosRef  = useRef(-1);
  // One timer ref per row — tracks the "press-and-hold" countdown before drag arms
  const holdTimersRef   = useRef(schedule.map(() => null));
  const armedRef        = useRef(schedule.map(() => false));

  useEffect(() => {
    setOrder(schedule.map((_, i) => i));
    orderRef.current = schedule.map((_, i) => i);
  }, [schedule.map(d => d.day + d.type + d.focus).join('|')]);

  const panResponders = useRef(
    schedule.map((_, origIdx) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder:  () => true,
        onPanResponderGrant: () => {
          // Start the hold timer — only arm drag after the user holds long enough
          armedRef.current[origIdx] = false;
          if (holdTimersRef.current[origIdx]) clearTimeout(holdTimersRef.current[origIdx]);
          holdTimersRef.current[origIdx] = setTimeout(() => {
            armedRef.current[origIdx] = true;
            holdTimersRef.current[origIdx] = null;
            const startPos = orderRef.current.indexOf(origIdx);
            dragStartPosRef.current = startPos;
            dragCurrPosRef.current  = startPos;
            dragAnim.setValue(0);
            setActive(origIdx);
            onDragActive?.(true);
          }, HOLD_MS);
        },
        onPanResponderMove: (_, gs) => {
          // Before hold completes: any meaningful movement cancels the long-press
          if (!armedRef.current[origIdx]) {
            if (Math.abs(gs.dx) > MOVE_CANCEL || Math.abs(gs.dy) > MOVE_CANCEL) {
              if (holdTimersRef.current[origIdx]) {
                clearTimeout(holdTimersRef.current[origIdx]);
                holdTimersRef.current[origIdx] = null;
              }
            }
            return;
          }
          // Drag is armed — handle reorder
          const fingerY    = dragStartPosRef.current * ITEM_H + gs.dy;
          const targetSlot = Math.max(0, Math.min(n - 1, Math.round(fingerY / ITEM_H)));
          if (targetSlot !== dragCurrPosRef.current) {
            const newOrder = [...orderRef.current];
            const [item]   = newOrder.splice(dragCurrPosRef.current, 1);
            newOrder.splice(targetSlot, 0, item);
            orderRef.current       = newOrder;
            dragCurrPosRef.current = targetSlot;
            setOrder([...newOrder]);
          }
          dragAnim.setValue(fingerY - dragCurrPosRef.current * ITEM_H);
        },
        onPanResponderRelease: () => {
          // Released before hold completed — cancel silently, no reorder
          if (holdTimersRef.current[origIdx]) {
            clearTimeout(holdTimersRef.current[origIdx]);
            holdTimersRef.current[origIdx] = null;
            return;
          }
          if (!armedRef.current[origIdx]) return;
          armedRef.current[origIdx] = false;
          setActive(-1);
          dragAnim.setValue(0);
          onDragActive?.(false);
          onReorder?.([...orderRef.current]);
        },
        onPanResponderTerminate: () => {
          if (holdTimersRef.current[origIdx]) {
            clearTimeout(holdTimersRef.current[origIdx]);
            holdTimersRef.current[origIdx] = null;
          }
          armedRef.current[origIdx] = false;
          setActive(-1);
          dragAnim.setValue(0);
          onDragActive?.(false);
        },
      })
    )
  ).current;

  return (
    <View style={{ height: n * ITEM_H, marginTop: 14 }}>
      {order.map((origIdx, posIdx) => {
        const dayData = schedule[origIdx] || { day: DAY_ORDER[posIdx], type: 'rest', focus: 'Rest & Recovery', exercises: [] };
        const dayDate = addDays(weekStart, posIdx);
        dayDate.setHours(0, 0, 0, 0);
        const isActive = origIdx === activeOrigIdx;

        return (
          <Animated.View
            key={origIdx}
            style={{
              position: 'absolute',
              top: posIdx * ITEM_H,
              left: 0, right: 0,
              zIndex:    isActive ? 10 : 1,
              elevation: isActive ? 8  : 1,
              transform: isActive ? [{ translateY: dragAnim }] : [],
            }}
          >
            <WorkoutDayCard
              dayData={dayData}
              dayDate={dayDate}
              onPress={() => onOpenWorkout(dayData, dayDate, weekNum)}
            />
            {/* Drag handle overlay — pinned to the right edge of the card */}
            <View
              {...panResponders[origIdx].panHandlers}
              style={styles.wdDragHandle}
            >
              <Text style={[styles.wdDragIcon, { color: colors.text3 }]}>≡</Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ── Drag-to-Reorder Day List ──────────────────────────────────────────────────

function DraggableDayList({ schedule, colors, onReorder, onDragActive }) {
  const styles       = useMemo(() => makeStyles(colors), [colors]);
  const ITEM_H       = 64;
  const n            = schedule.length;

  const [order, setOrder]           = useState(() => schedule.map((_, i) => i));
  const [activeOrigIdx, setActive]  = useState(-1);

  const orderRef        = useRef(order);
  const dragAnim        = useRef(new Animated.Value(0)).current;
  const dragStartPosRef = useRef(-1);
  const dragCurrPosRef  = useRef(-1);

  // Reset if the schedule prop itself changes (e.g. after a reorder is committed)
  useEffect(() => {
    setOrder(schedule.map((_, i) => i));
    orderRef.current = schedule.map((_, i) => i);
  }, [schedule.map(d => d.day + d.type + d.focus).join('|')]);

  // One PanResponder per ORIGINAL item index — created once, never re-created
  const panResponders = useRef(
    schedule.map((_, origIdx) =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder:  () => true,
        onPanResponderGrant: () => {
          const startPos = orderRef.current.indexOf(origIdx);
          dragStartPosRef.current = startPos;
          dragCurrPosRef.current  = startPos;
          dragAnim.setValue(0);
          setActive(origIdx);
          onDragActive?.(true);
        },
        onPanResponderMove: (_, gs) => {
          const fingerY    = dragStartPosRef.current * ITEM_H + gs.dy;
          const targetSlot = Math.max(0, Math.min(n - 1, Math.round(fingerY / ITEM_H)));
          if (targetSlot !== dragCurrPosRef.current) {
            const newOrder = [...orderRef.current];
            const [item]   = newOrder.splice(dragCurrPosRef.current, 1);
            newOrder.splice(targetSlot, 0, item);
            orderRef.current       = newOrder;
            dragCurrPosRef.current = targetSlot;
            setOrder([...newOrder]);
          }
          dragAnim.setValue(fingerY - dragCurrPosRef.current * ITEM_H);
        },
        onPanResponderRelease: () => {
          setActive(-1);
          dragAnim.setValue(0);
          onDragActive?.(false);
          onReorder([...orderRef.current]);
        },
        onPanResponderTerminate: () => {
          setActive(-1);
          dragAnim.setValue(0);
          onDragActive?.(false);
        },
      })
    )
  ).current;

  return (
    <View style={{ height: n * ITEM_H, marginBottom: 16 }}>
      {order.map((origIdx, posIdx) => {
        const day      = schedule[origIdx];
        const isRest   = day.type === 'rest';
        const isActive = origIdx === activeOrigIdx;
        const meta     = dayTypeMeta(day, colors);
        const stripe   = isRest ? colors.border : (meta?.accent || colors.accent);
        return (
          <Animated.View
            key={origIdx}
            style={[
              styles.dlRow,
              {
                position:   'absolute',
                top:        posIdx * ITEM_H,
                left: 0, right: 0,
                height:     ITEM_H - 8,
                backgroundColor: isActive ? colors.surface : colors.bg,
                borderColor:     isActive ? colors.accent  : colors.border,
                zIndex:          isActive ? 10 : 1,
                elevation:       isActive ? 8  : 1,
                shadowOpacity:   isActive ? 0.2 : 0,
                transform: isActive ? [{ translateY: dragAnim }] : [],
              },
            ]}
          >
            <View style={[styles.dlStripe, { backgroundColor: stripe }]} />
            <View style={{ flex: 1, paddingLeft: 10, justifyContent: 'center' }}>
              <Text style={[styles.dlDayName, { color: colors.text3 }]}>
                {DAY_ORDER[posIdx]}
              </Text>
              <Text style={[styles.dlFocus, { color: isRest ? colors.text3 : colors.text }]} numberOfLines={1}>
                {isRest ? 'Rest Day' : day.focus || 'Workout'}
              </Text>
            </View>
            {/* Drag handle — long-press and drag to reorder */}
            <View {...panResponders[origIdx].panHandlers} style={styles.dlHandle}>
              <Text style={[styles.dlHandleIcon, { color: colors.text3 }]}>≡</Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ── Plan Hub (v2.0 inactive-state landing) ──────────────────────────────────
// Shown when the user either has no plan yet OR has finished one and hasn't
// started another. Four cards (Runna-style):
//   1. Start new plan       → preset library
//   2. Restart current plan → reset startDate (hidden if no plan)
//   3. Continue plan        → only meaningful while mid-plan; shown but
//                             explains that the plan has ended
//   4. Generate Custom Plan → existing CreatePlanModal
//
// Active users skip this entirely and land on the week schedule below.

function PlanHubView({
  firstName, hasPlan, workoutPlan,
  onStartNewPlan, onRestartCurrentPlan, onContinuePlan, onGenerateCustomPlan,
  colors,
}) {
  const styles = makeStyles(colors);
  const subtitleText = hasPlan
    ? "You've finished this plan — pick what's next."
    : "Let's set up your first plan and get you moving.";

  // Hide Restart + Continue when there's no plan to restart/continue.
  const showRestart  = hasPlan;
  const showContinue = hasPlan;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.hubHeader}>
        <HeaderActions />
        <Text style={[styles.hubTitle, { color: colors.text }]}>Your Plan</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', marginTop: 28, marginBottom: 18 }}>
          <Text style={{ fontSize: 56 }}>👋</Text>
        </View>
        <Text style={[styles.hubGreeting, { color: colors.text }]}>
          {hasPlan ? `Welcome back, ${firstName}!` : `Welcome, ${firstName}!`}
        </Text>
        <Text style={[styles.hubSub, { color: colors.text2 }]}>{subtitleText}</Text>

        <View style={{ height: 18 }} />

        <HubCard label="Start new plan"        sub="Pick from our curated library"  onPress={onStartNewPlan}        colors={colors} />
        {showRestart  && <HubCard label="Restart current plan" sub={`Re-do "${workoutPlan?.planName || 'your plan'}" from week 1`} onPress={onRestartCurrentPlan} colors={colors} />}
        {showContinue && <HubCard label="Continue plan"        sub="Pick up where you left off"        onPress={onContinuePlan}        colors={colors} />}
        <HubCard label="Generate Custom Plan"  sub="AI-built around your goals + gear" onPress={onGenerateCustomPlan} colors={colors} />
      </ScrollView>
    </SafeAreaView>
  );
}

function HubCard({ label, sub, onPress, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: colors.surface,
        borderColor:     colors.border,
        borderWidth:     1,
        borderRadius:    16,
        paddingVertical: 22,
        paddingHorizontal: 20,
        marginBottom:    12,
        flexDirection:   'row',
        alignItems:      'center',
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{label}</Text>
        <Text style={{ color: colors.text3, fontSize: 13, marginTop: 4 }}>{sub}</Text>
      </View>
      <Text style={{ color: colors.text3, fontSize: 22 }}>›</Text>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const navigation = useNavigation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, workoutPlan, setWorkoutPlan, scheduledWorkouts, setScheduledWorkouts, planCompletions } = useStore();

  // v1.4.0 — re-schedule per-day workout reminders whenever the plan or the
  // user's completion state changes. The function is idempotent (cancels
  // prior plan-day notifs before re-scheduling) and bounded to a 7-day
  // horizon, so this is cheap to run on every render of these inputs.
  useEffect(() => {
    schedulePlanWorkoutReminders(workoutPlan, planCompletions || {});
  }, [workoutPlan, planCompletions]);

  // Also re-schedule when this screen comes into focus — covers the case
  // where a day rolled over while the app was backgrounded so today's
  // reminder gets cleared / tomorrow's gets queued.
  useFocusEffect(useCallback(() => {
    schedulePlanWorkoutReminders(workoutPlan, planCompletions || {});
  }, [workoutPlan, planCompletions]));

  const [showCreate,    setShowCreate]    = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  // detailWorkout = { dayData, dayDate } — when set, renders full-screen detail
  const [detailWorkout, setDetailWorkout] = useState(null);

  const firstName      = (user?.user_metadata?.full_name || user?.name || 'Athlete').split(' ')[0];
  const currentWeekNum = workoutPlan ? getCurrentWeekNum(workoutPlan) : 1;
  const totalWeeks     = workoutPlan?.durationWeeks || 12;
  const overallProgress = workoutPlan ? (currentWeekNum - 1) / totalWeeks : 0;

  const hasCoachSchedule = scheduledWorkouts?.length > 0;
  const hasPlan          = !!workoutPlan;

  // v2.0 — "active" means the user has a plan AND hasn't finished it yet.
  // Inactive users (no plan, or plan completed) land on the 4-card hub
  // instead of an empty / over-the-line week schedule.
  const planActive = hasPlan && currentWeekNum <= totalWeeks;
  const showHub    = !planActive;

  const openWorkout = (dayData, dayDate, weekNum) => setDetailWorkout({ dayData, dayDate, weekNum });
  const closeDetail = () => setDetailWorkout(null);

  // Called by DraggableDayList with the new ordered indices array
  const handleReorder = (newOrderedIndices) => {
    if (!workoutPlan) return;
    const newSchedule = newOrderedIndices.map((origIdx, posIdx) => ({
      ...workoutPlan.weeklySchedule[origIdx],
      day: DAY_ORDER[posIdx],
    }));
    const commit = () => setWorkoutPlan({ ...workoutPlan, weeklySchedule: newSchedule });

    // Coaching guard: warn on suboptimal sequencing (running on fatigued legs,
    // or heavy legs the day after a long run). User can override either way.
    const conflict = findOrderingConflict(newSchedule);
    if (conflict) {
      const cur  = newSchedule[conflict.idx];
      const next = newSchedule[(conflict.idx + 1) % newSchedule.length];
      const title = conflict.kind === 'leg-then-run'
        ? 'Heads up — run day after leg day'
        : 'Heads up — leg day after run day';
      const message = conflict.kind === 'leg-then-run'
        ? `You've placed "${next.focus || 'a run'}" the day after "${cur.focus || 'a leg session'}". Running on fatigued legs increases injury risk and dulls both sessions. We recommend at least one rest or upper-body day between them.`
        : `You've placed "${next.focus || 'a leg session'}" the day after "${cur.focus || 'a run'}". Heavy lower-body work on tired legs from running can compromise both sessions. A rest or upper-body day between them is usually better.`;
      Alert.alert(
        title,
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Move anyway', style: 'destructive', onPress: commit },
        ],
      );
      return;
    }
    commit();
  };

  // Intercept the phone's hardware/gesture back button so it closes the detail
  // view instead of navigating away from the Plan tab entirely
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (detailWorkout) {
          closeDetail();
          return true; // consumed — don't let React Navigation handle it
        }
        return false; // not in detail view — let normal back behaviour happen
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [detailWorkout])
  );

  const confirmDeletePlan = () => {
    Alert.alert(
      '🗑 Delete Plan?',
      'This will permanently delete your current training plan. Your workout logs will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, delete it', style: 'destructive', onPress: () => setWorkoutPlan(null) },
      ]
    );
  };

  const confirmDeleteCoachPlan = () => {
    Alert.alert(
      '🗑 Delete Coach Schedule?',
      'This will remove all workouts your coach added to the calendar. Your workout logs will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, delete it', style: 'destructive', onPress: () => setScheduledWorkouts([]) },
      ]
    );
  };

  // ── Full-screen detail view (replaces the plan list entirely) ──
  if (detailWorkout) {
    // For v1.1.0+ plans the LLM has already shaped exercises per phase, so we
    // suppress the legacy mechanical progression. Also pass the per-week note.
    const hasLlmPhases = Array.isArray(workoutPlan?.phases) && workoutPlan.phases.length > 0;
    return (
      <WorkoutDetailScreen
        workout={detailWorkout.dayData}
        dayDate={detailWorkout.dayDate}
        weekNum={detailWorkout.weekNum}
        totalWeeks={totalWeeks}
        useLlmProgression={hasLlmPhases}
        progressionNote={hasLlmPhases ? getProgressionNoteForWeek(workoutPlan, detailWorkout.weekNum) : null}
        onStart={(routine) => {
          closeDetail();
          // Routing by day type:
          //   crossfit / hyrox / mobility → dedicated CircuitTimer screen
          //     (AMRAP / EMOM / Rounds-For-Time countdowns + round counter)
          //   run / cardio                → Workout tab, GPS run flow autostarts
          //                                  (startRun param → gps-setup → countdown)
          //   strength (everything else)  → Workout tab, full routine ships in
          //                                  startRoutine param so it autostarts
          const circuitTypes = ['crossfit', 'hyrox', 'mobility'];
          if (circuitTypes.includes(routine.dayType)) {
            navigation.navigate('CircuitTimer', { routine });
          } else if (routine.type === 'cardio') {
            // Build a short "prescribed" description so the run-summary screen
            // can show what the plan called for. RunSummary renders this in
            // the Description section.
            const prescribed = [
              routine.name,
              ...((routine.exercises || []).map(e =>
                `• ${e.name}${e.duration ? ` · ${e.duration}` : ''}${e.distance ? ` · ${e.distance}` : ''}${e.pace ? ` · ${e.pace}` : ''}${e.rest ? ` · rest ${e.rest}` : ''}`
              )),
            ].filter(Boolean).join('\n');
            // Pass a fresh timestamp so the param reference always changes —
            // re-tapping Start Workout re-triggers the autostart effect.
            navigation.navigate('Workout', { startRun: 'run', startRunAt: Date.now(), prescribed });
          } else {
            navigation.navigate('Workout', { startRoutine: routine });
          }
        }}
      />
    );
  }

  const confirmNewPlan = () => {
    if (!workoutPlan) { setShowCreate(true); return; }
    Alert.alert(
      'Create New Plan?',
      'This will replace your current plan. Your workout history will be kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, new plan', style: 'destructive', onPress: () => setShowCreate(true) },
      ]
    );
  };

  // v2.0 — when the user has no active plan, render the 4-card hub instead
  // of the week schedule. Active users still get the existing UI.
  if (showHub) {
    return (
      <>
        <PlanHubView
          firstName={firstName}
          hasPlan={hasPlan}
          workoutPlan={workoutPlan}
          onStartNewPlan={() => navigation.navigate('PresetPlanLibrary')}
          onRestartCurrentPlan={() => {
            if (!workoutPlan) return;
            Alert.alert(
              'Restart this plan?',
              `Your week 1 will start today. Past completion marks stay on your history.`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Restart', onPress: () => setWorkoutPlan({ ...workoutPlan, startDate: new Date().toISOString() }) },
              ]
            );
          }}
          onContinuePlan={() => {
            // Plan is finished; "Continue" only makes sense after a Restart.
            // We surface the same restart confirm so users don't dead-end.
            if (workoutPlan) {
              Alert.alert(
                "You've finished this plan",
                'Tap Restart to begin it again from week 1, or pick a new one.',
                [{ text: 'OK' }]
              );
            }
          }}
          onGenerateCustomPlan={() => setShowCreate(true)}
          colors={colors}
        />
        <CreatePlanModal
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={plan => setWorkoutPlan(plan)}
        />
      </>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} scrollEnabled={scrollEnabled}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.pageTitle, { color: colors.text }]}>Plan</Text>
            <Text style={[styles.pageSub, { color: colors.text2 }]}>
              {hasPlan
                ? `Week ${currentWeekNum} of ${totalWeeks} · ${workoutPlan.planName}`
                : hasCoachSchedule
                ? 'Your coach schedule'
                : 'Build your programme'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {hasPlan && (
              <TouchableOpacity
                style={[styles.newPlanHeaderBtn, { backgroundColor: colors.accentDim }]}
                onPress={confirmNewPlan}
                activeOpacity={0.7}
              >
                <Text style={[styles.newPlanHeaderBtnText, { color: colors.accent }]}>New Plan</Text>
              </TouchableOpacity>
            )}
            <HeaderActions />
          </View>
        </View>

        {/* ── Empty state ── */}
        {!hasPlan && !hasCoachSchedule && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentDim }]}>
              <Text style={{ fontSize: 42 }}>🏋️</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No plan yet, {firstName}</Text>
            <Text style={[styles.emptySub, { color: colors.text2 }]}>
              Let your AI personal trainer build a customised programme based on your goals, fitness level, and available equipment. Or chat with your Coach to get a quick schedule.
            </Text>
            <View style={styles.featureList}>
              {[
                { icon: '🎯', text: 'Goal-specific programming' },
                { icon: '📅', text: 'Week-by-week schedule' },
                { icon: '📈', text: 'Progressive overload built in' },
                { icon: '😴', text: 'Optimal rest day placement' },
              ].map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Text style={styles.featureIcon}>{f.icon}</Text>
                  <Text style={[styles.featureText, { color: colors.text2 }]}>{f.text}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.accent }]} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
              <Text style={styles.createBtnText}>✨ Create My Plan</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Coach schedule only ── */}
        {!hasPlan && hasCoachSchedule && (
          <>
            <CoachScheduleCard scheduledWorkouts={scheduledWorkouts} onOpenWorkout={openWorkout} />
            <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.accent, marginTop: 4 }]} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
              <Text style={styles.createBtnText}>✨ Build a Full Training Plan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.deletePlanBtn, { borderColor: '#FF3B3022', marginTop: 8 }]} onPress={confirmDeleteCoachPlan} activeOpacity={0.7}>
              <Text style={styles.deletePlanBtnText}>🗑  Delete Coach Schedule</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Full plan view ── */}
        {hasPlan && (
          <>
            {/* Onboarding welcome banner — shown only for plans created during signup */}
            {workoutPlan.fromOnboarding && currentWeekNum === 1 && (
              <View style={[styles.onboardBanner, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '44' }]}>
                <Text style={{ fontSize: 22 }}>🎉</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.onboardBannerTitle, { color: colors.accent }]}>Your plan is live!</Text>
                  <Text style={[styles.onboardBannerSub, { color: colors.text2 }]}>
                    Built from your onboarding answers — tap any day to see your workouts.
                  </Text>
                </View>
              </View>
            )}

            {/* Plan header card */}
            <View style={[styles.planCard, { backgroundColor: colors.accent }]}>
              <View style={styles.planCardBg} />
              <View style={styles.planCardBg2} />

              {/* Delete button — top right corner so users can see which plan they're deleting */}
              <TouchableOpacity
                style={styles.planDeleteBtn}
                onPress={confirmDeletePlan}
                activeOpacity={0.7}
                accessibilityLabel="Delete this plan"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.planDeleteBtnIcon}>🗑</Text>
              </TouchableOpacity>

              <View style={styles.planTopRow}>
                <View style={[styles.planGoalBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                  <Text style={styles.planGoalText}>{workoutPlan.goal}</Text>
                </View>
                <Text style={[styles.planWeekLabel, { marginRight: 40 }]}>Week {currentWeekNum} / {totalWeeks}</Text>
              </View>
              <Text style={styles.planName}>{workoutPlan.planName}</Text>
              <Text style={styles.planDaysLabel}>{workoutPlan.daysPerWeek} days / week</Text>
              <View style={styles.segmentedBar}>
                {Array.from({ length: totalWeeks }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.segment,
                      { backgroundColor: i < currentWeekNum - 1
                          ? '#fff'
                          : i === currentWeekNum - 1
                          ? 'rgba(255,255,255,0.55)'
                          : 'rgba(255,255,255,0.2)'
                      },
                      i > 0 && { marginLeft: 3 },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.planProgressRow}>
                <Text style={styles.progressLabel}>{currentWeekNum - 1} of {totalWeeks} weeks completed</Text>
                <Text style={styles.progressLabel}>{Math.round(overallProgress * 100)}%</Text>
              </View>
            </View>

            {/* Coach schedule section */}
            {hasCoachSchedule && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>📅 Upcoming from Coach</Text>
                <CoachScheduleCard scheduledWorkouts={scheduledWorkouts} onOpenWorkout={openWorkout} />
                <TouchableOpacity style={[styles.deletePlanBtn, { borderColor: '#FF3B3022', marginTop: -4, marginBottom: 16 }]} onPress={confirmDeleteCoachPlan} activeOpacity={0.7}>
                  <Text style={styles.deletePlanBtnText}>🗑  Delete Coach Schedule</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Week-by-week */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>All Weeks</Text>
            <Text style={[styles.reorderHint, { color: colors.text3 }]}>Press and hold ≡ on a day, then drag to reorder</Text>
            {Array.from({ length: totalWeeks }, (_, i) => (
              <WeekCard
                key={i + 1}
                weekNum={i + 1}
                plan={workoutPlan}
                currentWeekNum={currentWeekNum}
                onOpenWorkout={openWorkout}
                onReorder={handleReorder}
                onDragActive={active => setScrollEnabled(!active)}
              />
            ))}

            {/* Coach note */}
            {workoutPlan.coachNote && (
              <View style={[styles.coachNoteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.coachNoteHeader}>
                  <Text style={styles.coachNoteIcon}>✨</Text>
                  <Text style={[styles.coachNoteTitle, { color: colors.text }]}>Coach's Note</Text>
                </View>
                <Text style={[styles.coachNoteText, { color: colors.text2 }]}>{workoutPlan.coachNote}</Text>
              </View>
            )}

            {/* Progression */}
            {workoutPlan.progression && (
              <View style={[styles.coachNoteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.coachNoteHeader}>
                  <Text style={styles.coachNoteIcon}>📈</Text>
                  <Text style={[styles.coachNoteTitle, { color: colors.text }]}>Progression Plan</Text>
                </View>
                <Text style={[styles.coachNoteText, { color: colors.text2 }]}>{workoutPlan.progression}</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.newPlanBtn, { borderColor: colors.border }]} onPress={confirmNewPlan} activeOpacity={0.7}>
              <Text style={[styles.newPlanBtnText, { color: colors.text2 }]}>✦ Create a New Plan</Text>
            </TouchableOpacity>
          </>
        )}

      </ScrollView>

      <CreatePlanModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={plan => setWorkoutPlan(plan)}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (colors) => StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },
  // v2.0 Plan Hub styles
  hubHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  hubTitle:       { fontSize: 17, fontWeight: '800' },
  hubGreeting:    { fontSize: 26, fontWeight: '900', textAlign: 'center' },
  hubSub:         { fontSize: 15, textAlign: 'center', marginTop: 8, paddingHorizontal: 12 },
  scroll:         { paddingHorizontal: 16, paddingBottom: 40 },

  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 20, paddingBottom: 16 },
  headerRight:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newPlanHeaderBtn:     { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  newPlanHeaderBtnText: { fontSize: 12, fontWeight: '700' },
  // Delete button pinned to the top-right of the plan header card
  planDeleteBtn:        { position: 'absolute', top: 10, right: 10, zIndex: 5, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  planDeleteBtnIcon:    { fontSize: 15 },
  pageTitle:      { fontSize: 34, fontWeight: '900', color: colors.text },
  pageSub:        { fontSize: 13, color: colors.text2, marginTop: 2, maxWidth: 220 },
  sectionTitle:   { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 4, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Empty state ──
  emptyState:     { alignItems: 'center', paddingTop: 20, paddingBottom: 20 },
  emptyIcon:      { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle:     { fontSize: 24, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  emptySub:       { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28, paddingHorizontal: 8 },
  featureList:    { width: '100%', marginBottom: 32, gap: 10 },
  featureRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureIcon:    { fontSize: 16 },
  featureText:    { fontSize: 14 },
  createBtn:      { width: '100%', borderRadius: 18, paddingVertical: 18, alignItems: 'center', shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 8 },
  createBtnText:  { color: '#fff', fontSize: 17, fontWeight: '800' },

  // ── Phase badge ──
  phaseBadge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  phaseBadgeText: { fontSize: 11, fontWeight: '700' },
  progressionNote:     { borderRadius: 12, padding: 12, marginTop: 12, marginBottom: 4, borderWidth: 1 },
  progressionNoteLabel:{ fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  progressionNoteText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  progressionTagRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  progressionTag:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  progressionTagText:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  phaseBox:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 14 },
  phaseDot:       { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  phaseBoxLabel:  { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  phaseBoxTip:    { fontSize: 13, lineHeight: 18 },

  // ── Drag-to-reorder list ──
  reorderHint:    { fontSize: 12, marginBottom: 10, marginTop: -6 },
  // Drag handle inside expanded week — sits on the right edge of each WorkoutDayCard
  wdDragHandle:   { position: 'absolute', right: 2, top: 0, bottom: 10, width: 40, alignItems: 'center', justifyContent: 'center' },
  wdDragIcon:     { fontSize: 22, fontWeight: '800' },
  dlRow:          { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
  dlStripe:       { width: 4, alignSelf: 'stretch' },
  dlDayName:      { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  dlFocus:        { fontSize: 14, fontWeight: '600' },
  dlHandle:       { paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  dlHandleIcon:   { fontSize: 22, fontWeight: '700', lineHeight: 26 },

  // ── Plan header card ──
  onboardBanner:      { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 16 },
  onboardBannerTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  onboardBannerSub:   { fontSize: 12, lineHeight: 18 },

  planCard:       { borderRadius: 22, padding: 20, marginBottom: 20, overflow: 'hidden' },
  planCardBg:     { position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)' },
  planCardBg2:    { position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)' },
  planTopRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  planGoalBadge:  { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  planGoalText:   { color: '#fff', fontSize: 12, fontWeight: '700' },
  planWeekLabel:  { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  planName:       { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 4, lineHeight: 26 },
  planDaysLabel:  { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 14 },
  segmentedBar:   { flexDirection: 'row', height: 6, marginBottom: 8 },
  segment:        { flex: 1, height: 6, borderRadius: 3 },
  planProgressRow:{ flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel:  { color: 'rgba(255,255,255,0.65)', fontSize: 12 },

  // ── Coach schedule card ──
  coachSchedCard:   { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 16, ...shadow.card },
  coachSchedHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  coachSchedIcon:   { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  coachSchedTitle:  { fontSize: 16, fontWeight: '800' },
  coachSchedSub:    { fontSize: 12, marginTop: 1 },
  schedDayRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  schedDayDot:      { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  schedDayDate:     { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, width: 90 },
  schedDayTitle:    { fontSize: 14, flex: 1 },
  schedDayDur:      { fontSize: 12 },

  // ── Week cards ──
  weekCard:         { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 10, ...shadow.card },
  weekCardHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  weekDateRange:    { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  weekTitle:        { fontSize: 20, fontWeight: '900' },
  currentBadge:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  currentBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  completedCheck:   { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  weekChevron:      { fontSize: 13 },
  weekProgressBg:   { height: 4, borderRadius: 2, marginBottom: 8 },
  weekProgressFill: { height: 4, borderRadius: 2 },
  weekStats:        { fontSize: 12 },

  // ── Shared ──
  todayPill:        { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 6 },
  todayPillText:    { color: '#fff', fontSize: 10, fontWeight: '800' },

  // ── Coach note / progression ──
  coachNoteCard:    { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, ...shadow.card },
  coachNoteHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  coachNoteIcon:    { fontSize: 20 },
  coachNoteTitle:   { fontSize: 15, fontWeight: '800' },
  coachNoteText:    { fontSize: 14, lineHeight: 22 },

  // ── New plan / Delete plan ──
  newPlanBtn:       { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, marginBottom: 10 },
  newPlanBtnText:   { fontSize: 14, fontWeight: '600' },
  deletePlanBtn:    { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FF3B3033', marginBottom: 10 },
  deletePlanBtnText:{ fontSize: 14, fontWeight: '600', color: '#FF3B30' },

  // ── Wizard modal ──
  modalOverlay:     { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet:       { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12, maxHeight: '92%' },
  modalHandle:      { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  stepRow:          { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 20 },
  stepDot:          { width: 8, height: 8, borderRadius: 4 },
  wizardTitle:      { fontSize: 22, fontWeight: '900', marginBottom: 6 },
  wizardSub:        { fontSize: 14, marginBottom: 20 },
  optionCard:       { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, borderWidth: 2, marginBottom: 10 },
  optionIcon:       { fontSize: 26 },
  optionLabel:      { fontSize: 16, fontWeight: '700' },
  optionDesc:       { fontSize: 12, marginTop: 2 },
  durationCard:     { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, borderWidth: 2 },
  durationLabel:    { fontSize: 16, fontWeight: '700' },
  durationTag:      { fontSize: 13, marginTop: 2 },
  hotBadge:         { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  hotText:          { color: '#fff', fontSize: 11, fontWeight: '700' },
  wizardBtn:        { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  wizardBtnBack:    { flex: 0.45, backgroundColor: 'transparent', borderWidth: 1 },
  wizardBtnText:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  capabilityInput:  { borderRadius: 16, padding: 16, borderWidth: 1, fontSize: 15, lineHeight: 22, minHeight: 120, marginBottom: 6 },
  capabilityHint:   { fontSize: 12, marginTop: 2 },
  loadingState:     { alignItems: 'center', paddingVertical: 48 },
  loadingTitle:     { fontSize: 20, fontWeight: '800', marginTop: 20, marginBottom: 10 },
  loadingSub:       { fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },

  // ── Workout day card ──
  // minHeight keeps every card the same size so the absolutely-positioned
  // DraggableWorkoutDayList (fixed 108px slots) has no gap after the shorter
  // rest-day cards. 98 + 10px marginBottom = the list's ITEM_H of 108.
  wdCard:           { borderRadius: 16, borderWidth: 2, flexDirection: 'row', minHeight: 98, ...shadow.card },
  wdStripe:         { width: 6, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  wdBody:           { flex: 1, padding: 14 },
  wdTopRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  wdDate:           { fontSize: 12, fontWeight: '600', flex: 1, marginRight: 8 },
  wdCheck:          { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  wdTitle:          { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  wdBottomRow:      { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  wdType:           { fontSize: 13 },
  wdExCount:        { fontSize: 13 },
  wdArrow:          { position: 'absolute', right: 14, bottom: 14, fontSize: 22, fontWeight: '300' },

  // ── Full-screen detail screen ──
  dsAccentBar:      { height: 4 },
  dsScroll:         { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  dsDate:           { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  dsTitle:          { fontSize: 30, fontWeight: '900', lineHeight: 34, marginBottom: 12 },
  dsPillRow:        { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  dsPill:           { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  dsPillText:       { fontSize: 13, fontWeight: '600' },

  dsRestBox:        { alignItems: 'center', paddingTop: 20, paddingBottom: 20 },
  dsRestTitle:      { fontSize: 24, fontWeight: '900', marginBottom: 10 },
  dsRestSub:        { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 8 },
  dsRestTipsCard:   { width: '100%', borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  dsRestTipRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderTopWidth: 1 },
  dsRestTipIcon:    { fontSize: 22 },
  dsRestTipText:    { fontSize: 15 },

  dsExSection:      { paddingTop: 4 },
  dsExSectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 14 },
  dsExCard:         { flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 10 },
  dsExNum:          { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dsExNumText:      { fontSize: 15, fontWeight: '900' },
  dsExName:         { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  dsChipRow:        { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dsChip:           { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, alignItems: 'center', minWidth: 60 },
  dsChipLabel:      { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  dsChipVal:        { fontSize: 15, fontWeight: '800' },

  dsFooter:         { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 32, borderTopWidth: 1 },
  dsStartBtn:       { borderRadius: 18, paddingVertical: 18, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  dsStartBtnText:   { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },

  // ── Exercise name row with info button ──
  dsExNameRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  dsInfoBtn:        { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dsInfoBtnText:    { fontSize: 16, fontWeight: '700' },

  // ── Exercise tutorial modal ──
  tutOverlay:       { flex: 1, justifyContent: 'flex-end' },
  tutBackdrop:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  tutSheet:         { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' },
  tutHandle:        { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  tutHeader:        { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 14 },
  tutEmojiWrap:     { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tutEmoji:         { fontSize: 26 },
  tutTitle:         { fontSize: 20, fontWeight: '800' },
  tutSub:           { fontSize: 13, marginTop: 2 },
  tutCloseX:        { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tutCloseXText:    { fontSize: 13, fontWeight: '600' },
  tutMeta:          { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingBottom: 8, flexWrap: 'wrap' },
  tutPill:          { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1 },
  tutPillIcon:      { fontSize: 13 },
  tutPillText:      { fontSize: 12, fontWeight: '500' },
  tutSteps:         { padding: 18 },
  tutStepsTitle:    { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 16 },
  tutStep:          { flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'flex-start' },
  tutStepNum:       { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  tutStepNumText:   { fontSize: 12, fontWeight: '800', color: '#fff' },
  tutStepText:      { flex: 1, fontSize: 14, lineHeight: 22 },
  tutTip:           { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginHorizontal: 18, marginBottom: 16, borderRadius: 16, padding: 14 },
  tutTipIcon:       { fontSize: 20, marginTop: 1 },
  tutTipLabel:      { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  tutTipText:       { fontSize: 13, lineHeight: 20 },
  tutFallback:      { margin: 18, borderRadius: 18, minHeight: 180, alignItems: 'center', justifyContent: 'center', padding: 24 },
  tutFallbackTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  tutFallbackSub:   { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  tutCloseBtn:      { marginHorizontal: 18, marginBottom: 8, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  tutCloseBtnText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
});
