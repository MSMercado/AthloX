import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Modal, ActivityIndicator, Alert, BackHandler,
  Animated, PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import useStore from '../store/useStore';
import useColors from '../lib/useColors';
import { shadow } from '../lib/theme';
import HeaderActions from '../components/HeaderActions';
import { EXERCISES } from '../data/exercises';
import { TUTORIALS } from '../data/exerciseTutorials';

// Name-based tutorial lookup — plan exercises from AI have names but no numeric IDs
const TUTORIALS_BY_NAME = {};
EXERCISES.forEach(ex => {
  if (TUTORIALS[ex.id]) {
    TUTORIALS_BY_NAME[ex.name.toLowerCase()] = TUTORIALS[ex.id];
  }
});
const getPlanTutorial = (name) =>
  TUTORIALS_BY_NAME[name?.toLowerCase()] || null;

const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const GOALS = [
  { id: 'lose_fat',     label: 'Lose Fat',            icon: '🔥', desc: 'Burn calories & reduce body fat' },
  { id: 'build_muscle', label: 'Build Muscle',         icon: '💪', desc: 'Increase muscle mass & size' },
  { id: 'get_strong',   label: 'Get Stronger',         icon: '🏋️', desc: 'Increase strength & power' },
  { id: 'endurance',    label: 'Improve Endurance',    icon: '🏃', desc: 'Run longer & last further' },
  { id: 'athletic',     label: 'Athletic Performance', icon: '🥇', desc: 'Train like a competitive athlete' },
  { id: 'general',      label: 'General Fitness',      icon: '⚡', desc: 'Overall health & wellness' },
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
              /* No tutorial in DB — show a friendly fallback */
              <View style={[styles.tutFallback, { backgroundColor: colors.bg }]}>
                <Text style={{ fontSize: 44, marginBottom: 14 }}>💪</Text>
                <Text style={[styles.tutFallbackTitle, { color: colors.text }]}>{exName}</Text>
                <Text style={[styles.tutFallbackSub, { color: colors.text2 }]}>
                  Ask your AI Coach for a full breakdown of this exercise — tap the Coach tab and type "{exName} how to do it".
                </Text>
              </View>
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

function WorkoutDetailScreen({ workout, dayDate, weekNum, totalWeeks, onStart }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [tutorialEx, setTutorialEx] = useState(null); // exercise name string

  if (!workout) return null;

  const isRest       = workout.type === 'rest';
  const isCardio     = workout.type === 'cardio';
  const isCoachItem  = !!workout.isCoachItem;
  const phase        = (weekNum && totalWeeks) ? getPhase(weekNum, totalWeeks) : null;
  const accentCol    = isCardio ? colors.green : colors.accent;
  const baseExercises = workout.exercises || [];
  const exercises    = (phase && !isCardio && !isCoachItem)
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
                {isCoachItem ? '✨ Coach' : isCardio ? '🏃 Cardio' : '💪 Strength'}
              </Text>
            </View>
          )}
          {!isRest && exercises.length > 0 && (
            <View style={[styles.dsPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.dsPillText, { color: colors.text2 }]}>{exercises.length} exercises</Text>
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
            {/* Progressive overload guidance */}
            {phase && !isCardio && (
              <View style={[styles.phaseBox, { backgroundColor: phase.color + '15', borderColor: phase.color + '44' }]}>
                <View style={[styles.phaseDot, { backgroundColor: phase.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.phaseBoxLabel, { color: phase.color }]}>Week {weekNum} — {phase.label} Phase</Text>
                  <Text style={[styles.phaseBoxTip, { color: colors.text2 }]}>{phase.tip}</Text>
                </View>
              </View>
            )}
            <Text style={[styles.dsExSectionLabel, { color: colors.text3 }]}>EXERCISES</Text>
            {exercises.map((ex, i) => (
              <View
                key={i}
                style={[styles.dsExCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                {/* Number badge */}
                <View style={[styles.dsExNum, { backgroundColor: accentCol + '22' }]}>
                  <Text style={[styles.dsExNumText, { color: accentCol }]}>{i + 1}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  {/* Name row with ⓘ button */}
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

                  {/* Chips row */}
                  <View style={styles.dsChipRow}>
                    <View style={[styles.dsChip, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                      <Text style={[styles.dsChipLabel, { color: colors.text3 }]}>SETS</Text>
                      <Text style={[styles.dsChipVal, { color: colors.text }]}>{ex.sets}</Text>
                    </View>
                    <View style={[styles.dsChip, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                      <Text style={[styles.dsChipLabel, { color: colors.text3 }]}>REPS</Text>
                      <Text style={[styles.dsChipVal, { color: colors.text }]}>{ex.reps}</Text>
                    </View>
                    <View style={[styles.dsChip, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                      <Text style={[styles.dsChipLabel, { color: colors.text3 }]}>REST</Text>
                      <Text style={[styles.dsChipVal, { color: colors.text }]}>{ex.rest}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Start Workout button (workout days + coach items) ── */}
      {!isRest && (
        <View style={[styles.dsFooter, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.dsStartBtn, { backgroundColor: accentCol }]}
            onPress={onStart}
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

  const [step, setStep]           = useState(0);
  const [goal, setGoal]           = useState(null);
  const [duration, setDuration]   = useState(12);
  const [daysPerWk, setDaysPerWk] = useState(4);

  const meta      = user?.user_metadata || {};
  const level     = meta.level      || user?.level      || 'Beginner';
  const equipment = (meta.equipment || ['No equipment']).join(', ');
  const styles_   = (meta.styles    || []).join(', ') || 'general fitness';
  const ageGroup  = meta.ageGroup   || 'unknown';
  const userGoals = (meta.goals     || []).join(', ') || 'general fitness';
  const firstName = (meta.full_name || user?.name || 'Athlete').split(' ')[0];

  const reset = () => { setStep(0); setGoal(null); setDuration(12); setDaysPerWk(4); };
  const close = () => { reset(); onClose(); };

  const levelGuidelines = level.toLowerCase().includes('beginner')
    ? `CRITICAL — this is a BEGINNER. You MUST follow these rules:
- NO burpees, box jumps, jump squats, or any explosive/plyometric movements
- NO exercises that require advanced coordination or balance
- Stick to these beginner-safe movements ONLY: bodyweight squats, lunges, glute bridges, push-ups (full or knee), planks, dead bugs, bird dogs, dumbbell rows, shoulder press with light weight, lat pull-downs, step-ups
- Sets: 2–3 per exercise. Reps: 10–15. Rest: 90 seconds between sets
- Keep the plan encouraging — beginners need to build confidence`
    : level.toLowerCase().includes('intermediate')
    ? `This is an INTERMEDIATE user:
- Include compound lifts (squats, deadlifts, bench press, rows) and moderate bodyweight work
- Sets: 3–4 per exercise. Reps: 8–12. Rest: 60–90 seconds`
    : `This is an ADVANCED user:
- Include heavy compound lifts, complex movements, and high-intensity techniques
- Sets: 4–5. Rep ranges vary (3–6 strength, 8–12 hypertrophy, 15–20 endurance). Rest: 45–60 seconds`;

  const buildPrompt = () => `You are an elite personal trainer. Create a ${duration}-week workout plan for ${firstName}.

User profile:
- Fitness level: ${level}
- Age group: ${ageGroup}
- Available equipment: ${equipment}
- Training styles: ${styles_}
- Existing goals: ${userGoals}
- Selected plan goal: ${goal}
- Training days per week: ${daysPerWk}

${levelGuidelines}

Design a realistic, progressive, professional plan. Distribute exactly ${daysPerWk} workout days across the week, the remaining days are rest or active recovery. For each workout day include 4–6 exercises strictly appropriate for the user's level and equipment above.

Respond with ONLY a valid JSON object, no markdown fences, no extra text:
{
  "planName": "descriptive name",
  "goal": "${goal}",
  "durationWeeks": ${duration},
  "daysPerWeek": ${daysPerWk},
  "weeklySchedule": [
    {
      "day": "Monday",
      "type": "workout",
      "focus": "e.g. Upper Body Push",
      "exercises": [
        { "name": "Exercise", "sets": 3, "reps": "8-12", "rest": "60s" }
      ]
    },
    {
      "day": "Tuesday",
      "type": "rest",
      "focus": "Rest & Recovery",
      "exercises": []
    }
  ],
  "progression": "Week-by-week progression instructions",
  "coachNote": "Motivating personal message to ${firstName}"
}`;

  const generate = async () => {
    setStep(3);
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: buildPrompt() }],
          max_tokens: 2500,
          temperature: 0.4,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

      const raw     = data?.choices?.[0]?.message?.content?.trim() || '';
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      const plan    = JSON.parse(cleaned);
      plan.startDate = new Date().toISOString();
      onCreated(plan);
      close();
    } catch (err) {
      Alert.alert('Error generating plan', err?.message || 'Try again');
      setStep(2);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={close} />
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

          {step === 3 ? (
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
                {[0,1,2].map(i => (
                  <View key={i} style={[styles.stepDot, { backgroundColor: i <= step ? colors.accent : colors.border }]} />
                ))}
              </View>

              {step === 0 && (
                <>
                  <Text style={[styles.wizardTitle, { color: colors.text }]}>What's your main goal?</Text>
                  <Text style={[styles.wizardSub, { color: colors.text2 }]}>Your plan will be built around this</Text>
                  <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                    {GOALS.map(g => (
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

  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const isToday = dayDate?.toDateString() === today.toDateString();
  const isPast  = dayDate < today && !isToday;
  const isRest  = dayData.type === 'rest';

  const stripeCol = isPast && !isRest ? colors.green
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
      style={{ marginBottom: 10, borderRadius: 16, opacity: isPast && isRest ? 0.5 : 1 }}
    >
      <View style={[
        styles.wdCard,
        { backgroundColor: colors.surface, borderColor: borderCol },
        isToday && { borderWidth: 2 },
      ]}>
        {/* Colored left stripe */}
        <View style={[styles.wdStripe, { backgroundColor: stripeCol }]} />

        <View style={styles.wdBody}>
          {/* Top row: date + checkbox */}
          <View style={styles.wdTopRow}>
            <Text style={[styles.wdDate, { color: isToday ? colors.accent : colors.text3 }]}>
              {dateLabel}{!isRest ? ` · ~${estMins}m` : ''}
            </Text>
            <View style={[
              styles.wdCheck,
              { borderColor: isPast && !isRest ? colors.green : colors.border },
              isPast && !isRest && { backgroundColor: colors.green },
            ]}>
              {isPast && !isRest && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>✓</Text>}
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.wdTitle, { color: isRest ? colors.text3 : colors.text }]}>
            {isRest ? 'Rest Day' : dayData.focus || 'Workout'}
          </Text>

          {/* Bottom row */}
          {!isRest && (
            <View style={styles.wdBottomRow}>
              <Text style={[styles.wdType, { color: colors.text3 }]}>
                {dayData.type === 'cardio' ? '🏃 Cardio' : '💪 Strength'}
              </Text>
              {dayData.exercises?.length > 0 && (
                <Text style={[styles.wdExCount, { color: colors.text3 }]}>
                  {' '}· {dayData.exercises.length} exercises
                </Text>
              )}
              {isToday && (
                <View style={[styles.todayPill, { backgroundColor: colors.accent, marginLeft: 8 }]}>
                  <Text style={styles.todayPillText}>Today</Text>
                </View>
              )}
            </View>
          )}

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

function getPhase(weekNum, totalWeeks) {
  const pct = weekNum / totalWeeks;
  if (pct <= 0.33) return { label: 'Foundation', color: '#3b82f6', tip: 'Build your base — master form before adding load' };
  if (pct <= 0.66) return { label: 'Build',       color: '#f59e0b', tip: 'Volume increases this phase — +1 set per exercise vs Foundation' };
  return               { label: 'Peak',        color: '#ef4444', tip: 'Maximum effort — sets and reps at their highest point' };
}

// Apply progressive overload per phase: Foundation = base, Build = +1 set, Peak = +2 sets & heavier reps
function applyProgression(exercises, phase) {
  if (!exercises?.length || phase.label === 'Foundation') return exercises;
  return exercises.map(ex => {
    const baseSets = typeof ex.sets === 'number' ? ex.sets : 3;
    const sets = phase.label === 'Build'
      ? Math.min(baseSets + 1, 5)
      : Math.min(baseSets + 2, 6); // Peak
    let reps = ex.reps || '10';
    if (phase.label === 'Peak' && typeof reps === 'string') {
      // Bump every number in a rep range, e.g. "8-12" → "10-14", "10" → "12"
      reps = reps.replace(/\d+/g, n => String(Math.min(parseInt(n) + 2, 30)));
    }
    return { ...ex, sets, reps };
  });
}

function WeekCard({ weekNum, plan, currentWeekNum, onOpenWorkout }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const isCompleted = weekNum < currentWeekNum;
  const isCurrent   = weekNum === currentWeekNum;
  const [expanded, setExpanded] = useState(isCurrent);
  const phase = getPhase(weekNum, plan.durationWeeks || 12);

  const planStart = new Date(plan.startDate);
  const weekStart = getMondayOfWeek(addDays(planStart, (weekNum - 1) * 7));
  const weekEnd   = addDays(weekStart, 6);
  const today     = new Date(); today.setHours(0, 0, 0, 0);

  const daysPassed    = isCurrent
    ? Math.min(Math.max(Math.floor((today - weekStart) / 86400000) + 1, 0), 7)
    : isCompleted ? 7 : 0;
  const weekProgress  = daysPassed / 7;

  const schedule      = plan.weeklySchedule || [];
  const workoutDays   = schedule.filter(d => d.type !== 'rest');
  const estimatedMins = workoutDays.reduce((s, d) => s + (d.exercises?.length || 0) * 8, 0) || workoutDays.length * 30;

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

      {/* Expanded: workout day cards */}
      {expanded && (
        <View style={{ marginTop: 14 }}>
          {DAY_ORDER.map((dayName, i) => {
            const dayData = schedule.find(d => d.day === dayName)
              || { day: dayName, type: 'rest', focus: 'Rest & Recovery', exercises: [] };
            const dayDate = addDays(weekStart, i);
            dayDate.setHours(0, 0, 0, 0);
            return (
              <WorkoutDayCard
                key={dayName}
                dayData={dayData}
                dayDate={dayDate}
                onPress={() => onOpenWorkout(dayData, dayDate, weekNum)}
              />
            );
          })}
        </View>
      )}
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
        const stripe   = day.type === 'cardio' ? colors.green
                       : isRest               ? colors.border
                       :                        colors.accent;
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

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const navigation = useNavigation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, workoutPlan, setWorkoutPlan, scheduledWorkouts, setScheduledWorkouts } = useStore();

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

  const openWorkout = (dayData, dayDate, weekNum) => setDetailWorkout({ dayData, dayDate, weekNum });
  const closeDetail = () => setDetailWorkout(null);

  // Called by DraggableDayList with the new ordered indices array
  const handleReorder = (newOrderedIndices) => {
    if (!workoutPlan) return;
    const newSchedule = newOrderedIndices.map((origIdx, posIdx) => ({
      ...workoutPlan.weeklySchedule[origIdx],
      day: DAY_ORDER[posIdx],
    }));
    setWorkoutPlan({ ...workoutPlan, weeklySchedule: newSchedule });
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
    return (
      <WorkoutDetailScreen
        workout={detailWorkout.dayData}
        dayDate={detailWorkout.dayDate}
        weekNum={detailWorkout.weekNum}
        totalWeeks={totalWeeks}
        onStart={() => { closeDetail(); navigation.navigate('Workout'); }}
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
              <View style={styles.planTopRow}>
                <View style={[styles.planGoalBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                  <Text style={styles.planGoalText}>{workoutPlan.goal}</Text>
                </View>
                <Text style={styles.planWeekLabel}>Week {currentWeekNum} / {totalWeeks}</Text>
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

            {/* ── Weekly Schedule (drag ≡ to reorder) ── */}
            <View style={{ marginBottom: 4 }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Weekly Schedule</Text>
              <Text style={[styles.reorderHint, { color: colors.text3 }]}>Hold ≡ and drag to reorder days</Text>
            </View>
            <DraggableDayList
              key={(workoutPlan.weeklySchedule || []).map(d => d.day + d.type).join('|')}
              schedule={workoutPlan.weeklySchedule || []}
              colors={colors}
              onReorder={handleReorder}
              onDragActive={active => setScrollEnabled(!active)}
            />

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
            {Array.from({ length: totalWeeks }, (_, i) => (
              <WeekCard
                key={i + 1}
                weekNum={i + 1}
                plan={workoutPlan}
                currentWeekNum={currentWeekNum}
                onOpenWorkout={openWorkout}
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

            <TouchableOpacity style={[styles.deletePlanBtn, { borderColor: '#FF3B3022' }]} onPress={confirmDeletePlan} activeOpacity={0.7}>
              <Text style={styles.deletePlanBtnText}>🗑  Delete This Plan</Text>
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
  scroll:         { paddingHorizontal: 16, paddingBottom: 40 },

  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 20, paddingBottom: 16 },
  headerRight:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newPlanHeaderBtn:     { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  newPlanHeaderBtnText: { fontSize: 12, fontWeight: '700' },
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
  phaseBox:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 14 },
  phaseDot:       { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  phaseBoxLabel:  { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  phaseBoxTip:    { fontSize: 13, lineHeight: 18 },

  // ── Drag-to-reorder list ──
  reorderHint:    { fontSize: 12, marginBottom: 10, marginTop: -6 },
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
  loadingState:     { alignItems: 'center', paddingVertical: 48 },
  loadingTitle:     { fontSize: 20, fontWeight: '800', marginTop: 20, marginBottom: 10 },
  loadingSub:       { fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },

  // ── Workout day card ──
  wdCard:           { borderRadius: 16, borderWidth: 1, flexDirection: 'row', ...shadow.card },
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
