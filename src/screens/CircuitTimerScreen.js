// CircuitTimerScreen — the dedicated timer for CrossFit and Hyrox days.
//
// Routed from PlanScreen's WorkoutDetailScreen when the user taps Start Workout
// on a day with type 'crossfit' or 'hyrox'. The strength tracker is built for
// sets × reps; the GPS tracker is built for distance; circuits need their own:
//
//   - Big visible timer (countdown for AMRAP-style formats, stopwatch for
//     Rounds For Time / chippers)
//   - Movement list with reps / distance / weight (whatever the LLM gave us)
//   - Round counter for "X Rounds For Time" formats
//   - Pause / resume + finish

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import useColors from '../lib/useColors';
import useStore from '../store/useStore';
import { XP_REWARDS, computeStrengthXP } from '../lib/xp';

// ─── Format parsing ──────────────────────────────────────────────────────────
// Take the LLM's free-form format string and decide what kind of timer to run.
//
// Returns:
//   { mode: 'amrap',     durationSec: 720 }        — countdown timer
//   { mode: 'emom',      durationSec: 600, intervalSec: 60 } — countdown with 1-min beeps
//   { mode: 'stopwatch', rounds: 5 }               — counts up, 5 rounds expected
//   { mode: 'stopwatch' }                          — generic counts-up
function parseFormat(format) {
  if (!format || typeof format !== 'string') return { mode: 'stopwatch' };
  const f = format.toLowerCase();

  // AMRAP: "AMRAP 12 min" / "12 min AMRAP" / "12-min AMRAP"
  const amrapMatch = f.match(/amrap.*?(\d+)\s*min|(\d+)\s*[- ]?min.*?amrap/);
  if (amrapMatch) {
    const minutes = parseInt(amrapMatch[1] || amrapMatch[2], 10);
    return { mode: 'amrap', durationSec: minutes * 60 };
  }

  // EMOM: "EMOM 10 min" — treat as 10-min countdown for now
  const emomMatch = f.match(/emom.*?(\d+)\s*min|(\d+)\s*[- ]?min.*?emom/);
  if (emomMatch) {
    const minutes = parseInt(emomMatch[1] || emomMatch[2], 10);
    return { mode: 'emom', durationSec: minutes * 60, intervalSec: 60 };
  }

  // Rounds For Time: "5 Rounds For Time" / "5 RFT" / "3 Rounds for Quality"
  const rftMatch = f.match(/(\d+)\s*round/);
  if (rftMatch) {
    return { mode: 'stopwatch', rounds: parseInt(rftMatch[1], 10) };
  }

  // Otherwise just a stopwatch (e.g. "21-15-9 Chipper", "Hyrox Workout", "For Time")
  return { mode: 'stopwatch' };
}

function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function CircuitTimerScreen() {
  const colors = useColors();
  const navigation = useNavigation();
  const route = useRoute();
  const routine = route.params?.routine || {};
  const { logs, addLog, addXP } = useStore();

  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const parsed = useMemo(() => parseFormat(routine.format), [routine.format]);
  const isAmrap = parsed.mode === 'amrap' || parsed.mode === 'emom';
  const targetRounds = parsed.rounds || null;

  // ── State ──
  // 'ready' = pre-countdown, 'countdown' = 3-2-1 lead-in, 'active' = timer
  // running, 'done' = workout finished
  const [phase, setPhase]            = useState('ready');
  const [countdown, setCountdown]    = useState(3);
  const [elapsedSec, setElapsed]     = useState(0);
  const [paused, setPaused]          = useState(false);
  const [roundsDone, setRounds]      = useState(0);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);
  const startedAtRef = useRef(0);

  // ── Tick the timer ──
  useEffect(() => {
    if (phase !== 'active' || paused) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        // AMRAP auto-finish when countdown reaches the target duration
        if (isAmrap && next >= (parsed.durationSec || 0)) {
          clearInterval(intervalRef.current);
          finish(parsed.durationSec, /*auto*/ true);
          return parsed.durationSec;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [phase, paused, isAmrap, parsed.durationSec]);

  // ── Hardware back: confirm before bailing on an active circuit ──
  useFocusEffect(useCallback(() => {
    const handler = () => {
      if (phase === 'active') {
        Alert.alert(
          'Quit workout?',
          'Your timer will be lost and no XP awarded.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Quit', style: 'destructive', onPress: () => navigation.goBack() },
          ],
        );
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, [phase, navigation]));

  // ── Lifecycle ──
  // 'Start Circuit' kicks off a 3-2-1 countdown so the user has time to put
  // the phone down and get into starting position before the workout timer
  // begins counting.
  const start = () => {
    setPhase('countdown');
    setCountdown(3);
    setElapsed(0);
    setRounds(0);
    setPaused(false);
  };

  useEffect(() => {
    if (phase !== 'countdown') {
      clearInterval(countdownRef.current);
      return;
    }
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(countdownRef.current);
          setPhase('active');
          startedAtRef.current = Date.now();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [phase]);

  const finish = (elapsedOverride = null, auto = false) => {
    clearInterval(intervalRef.current);
    setPhase('done');
    const finalElapsed = elapsedOverride != null ? elapsedOverride : elapsedSec;

    // Log it as a workout — strength type so it shows in Recent Activity
    const isFirst = logs.length === 0;
    addLog({
      id:       Date.now(),
      date:     todayStr(),
      ts:       Date.now(),
      routine:  routine.name || 'Circuit',
      duration: Math.round(finalElapsed / 60),
      calories: Math.round(finalElapsed / 60 * 8), // rough: 8 kcal/min for circuit work
      type:     'strength',
    });

    // XP — treat completed rounds as completed sets for the strength XP formula.
    // If there's no rounds counter, give a flat reward scaled by minutes
    // (gated by the 60s anti-exploit minimum).
    let xp = 0;
    if (targetRounds && targetRounds > 0) {
      xp = computeStrengthXP(roundsDone, targetRounds, finalElapsed);
    } else if (finalElapsed >= 60) {
      // 6 XP per minute, capped at 100 (matches strength full-workout reward)
      xp = Math.min(100, Math.round(finalElapsed / 60 * 6));
    }
    if (xp > 0 && isFirst) xp += XP_REWARDS.FIRST_WORKOUT;
    if (xp > 0) addXP(xp);

    if (!auto) {
      // nothing — leave user on the done screen
    }
  };

  // ── Render ──
  const accent = routine.color || colors.accent;
  const exercises = Array.isArray(routine.exercises) ? routine.exercises : [];

  // ─── 3-2-1 countdown ─────────────────────────────────────────────────────
  if (phase === 'countdown') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
        <View style={styles.countdownWrap}>
          <Text style={styles.countdownLabel}>Get ready</Text>
          <Text style={[styles.countdownValue, { color: accent }]}>{countdown}</Text>
          <Text style={styles.countdownSub}>{routine.format || 'Circuit'} starts in…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Pre-start (ready) ────────────────────────────────────────────────────
  if (phase === 'ready') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: accent }]}>{routine.format || 'Circuit'}</Text>
          <Text style={styles.subtitle}>{routine.name || 'Workout'}</Text>

          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Movements</Text>
            {exercises.length === 0 ? (
              <Text style={styles.empty}>No movements provided.</Text>
            ) : exercises.map((ex, i) => (
              <View key={i} style={styles.previewRow}>
                <View style={[styles.previewNum, { backgroundColor: accent + '22' }]}>
                  <Text style={[styles.previewNumText, { color: accent }]}>{i + 1}</Text>
                </View>
                <Text style={styles.previewName}>{ex.name}</Text>
                <Text style={styles.previewMeta}>
                  {[ex.reps && `${ex.reps} reps`, ex.distance, ex.weight, ex.duration]
                    .filter(Boolean).join(' · ') || ''}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.howCard}>
            <Text style={[styles.howLabel, { color: accent }]}>How to read this</Text>
            <Text style={styles.howText}>
              {isAmrap
                ? `Complete as many rounds as possible in ${Math.floor((parsed.durationSec || 0) / 60)} minutes. Move at a steady pace you can sustain — don't blow up in the first round.`
                : targetRounds
                  ? `Complete ${targetRounds} rounds of the movements above as fast as possible. Tap "Round Complete" after each full pass through the list.`
                  : 'Move through the movements in order. The stopwatch will count up — finish as fast as you can with good form.'}
            </Text>
          </View>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: 16 + (insets.bottom || 0) }]}>
          <TouchableOpacity style={[styles.startBtn, { backgroundColor: accent }]} onPress={start} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>▶ Start Circuit</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Done ─────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]} edges={['top']}>
        <View style={styles.doneWrap}>
          <Text style={styles.doneEmoji}>🔥</Text>
          <Text style={styles.doneTitle}>Workout Logged</Text>
          <Text style={styles.doneSub}>
            {isAmrap
              ? `${roundsDone} rounds in ${Math.floor(elapsedSec / 60)} min`
              : targetRounds
                ? `${roundsDone} of ${targetRounds} rounds · ${fmtTime(elapsedSec)}`
                : `${fmtTime(elapsedSec)} total time`}
          </Text>
          <TouchableOpacity style={[styles.startBtn, { backgroundColor: accent, marginTop: 30 }]} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Active ───────────────────────────────────────────────────────────────
  const remainingSec = isAmrap ? Math.max(0, (parsed.durationSec || 0) - elapsedSec) : null;
  const displayTime = isAmrap ? fmtTime(remainingSec) : fmtTime(elapsedSec);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => Alert.alert(
            'Quit workout?',
            'Your timer will be lost and no XP awarded.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Quit', style: 'destructive', onPress: () => navigation.goBack() },
            ],
          )}
          style={styles.headerBtn}
        >
          <Text style={styles.headerBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerCenter}>{routine.format || 'Circuit'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.activeScroll} showsVerticalScrollIndicator={false}>
        {/* Timer */}
        <View style={[styles.timerBox, { borderColor: accent + '55' }]}>
          <Text style={[styles.timerValue, { color: accent }]}>{displayTime}</Text>
          <Text style={styles.timerLabel}>
            {isAmrap ? 'remaining' : 'elapsed'}
          </Text>
        </View>

        {/* Round counter */}
        <View style={styles.roundBox}>
          <Text style={styles.roundLabel}>
            Rounds {targetRounds ? `(target: ${targetRounds})` : 'completed'}
          </Text>
          <Text style={[styles.roundValue, { color: accent }]}>{roundsDone}</Text>
          <TouchableOpacity
            style={[styles.roundBtn, { backgroundColor: accent + '22', borderColor: accent + '55' }]}
            onPress={() => {
              setRounds(r => {
                const next = r + 1;
                // Auto-finish when target rounds reached on Rounds For Time
                if (targetRounds && next >= targetRounds && !isAmrap) {
                  setTimeout(() => finish(), 100);
                }
                return next;
              });
            }}
            activeOpacity={0.8}
            disabled={paused}
          >
            <Text style={[styles.roundBtnText, { color: accent }]}>+ Round Complete</Text>
          </TouchableOpacity>
        </View>

        {/* Movement list (compact reference) */}
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>Movements (one round)</Text>
          {exercises.map((ex, i) => (
            <View key={i} style={styles.previewRow}>
              <View style={[styles.previewNum, { backgroundColor: accent + '22' }]}>
                <Text style={[styles.previewNumText, { color: accent }]}>{i + 1}</Text>
              </View>
              <Text style={styles.previewName}>{ex.name}</Text>
              <Text style={styles.previewMeta}>
                {[ex.reps && `${ex.reps} reps`, ex.distance, ex.weight, ex.duration]
                  .filter(Boolean).join(' · ') || ''}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer: pause + finish */}
      <View style={[styles.activeFooter, { paddingBottom: 16 + (insets.bottom || 0) }]}>
        <TouchableOpacity
          style={[styles.pauseBtn, { borderColor: colors.border }]}
          onPress={() => setPaused(p => !p)}
          activeOpacity={0.8}
        >
          <Text style={styles.pauseBtnText}>{paused ? '▶ Resume' : '❚❚ Pause'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.finishBtn, { backgroundColor: accent }]}
          onPress={() => finish()}
          activeOpacity={0.85}
        >
          <Text style={styles.finishBtnText}>Finish Workout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const makeStyles = (colors) => StyleSheet.create({
  container:    { flex: 1 },
  scroll:       { padding: 20, paddingBottom: 120 },
  activeScroll: { padding: 20, paddingBottom: 140 },

  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  // Back/close button: use auto width with padding so "← Back" doesn't wrap
  // inside a fixed 40px box (which produced "B" / "ack" on two lines).
  headerBtn:    { minHeight: 40, paddingHorizontal: 4, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  headerBtnText:{ color: '#fff', fontSize: 17, fontWeight: '700' },
  headerCenter: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },

  title:        { fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5, marginTop: 10 },
  subtitle:     { color: '#aaa', fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 4, marginBottom: 24 },

  timerBox:     { borderRadius: 24, padding: 28, alignItems: 'center', borderWidth: 2, marginBottom: 20, backgroundColor: '#0a0a0a' },
  timerValue:   { fontSize: 88, fontWeight: '900', letterSpacing: 2, lineHeight: 96 },
  timerLabel:   { color: '#888', fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },

  roundBox:     { backgroundColor: '#0a0a0a', borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 20 },
  roundLabel:   { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  roundValue:   { fontSize: 44, fontWeight: '900', marginVertical: 6 },
  roundBtn:     { borderWidth: 1, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, marginTop: 6 },
  roundBtnText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.4 },

  previewBox:   { backgroundColor: '#0a0a0a', borderRadius: 16, padding: 16, marginBottom: 16 },
  previewLabel: { color: '#888', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  previewRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  previewNum:   { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  previewNumText:{ fontSize: 13, fontWeight: '800' },
  previewName:  { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  previewMeta:  { color: '#aaa', fontSize: 12, fontWeight: '500' },

  howCard:      { backgroundColor: '#0a0a0a', borderRadius: 14, padding: 16, marginBottom: 16 },
  howLabel:     { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  howText:      { color: '#ddd', fontSize: 13, lineHeight: 19 },

  empty:        { color: '#888', fontSize: 14, fontStyle: 'italic', textAlign: 'center', padding: 12 },

  footer:       { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: '#000', borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  startBtn:     { borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.4 },

  activeFooter: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: '#000', borderTopWidth: 1, borderTopColor: '#1a1a1a', flexDirection: 'row', gap: 10 },
  pauseBtn:     { flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1 },
  pauseBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  finishBtn:    { flex: 1.5, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  finishBtnText:{ color: '#fff', fontSize: 15, fontWeight: '800' },

  doneWrap:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  doneEmoji:    { fontSize: 64, marginBottom: 20 },
  doneTitle:    { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 8 },
  doneSub:      { color: '#aaa', fontSize: 15, textAlign: 'center' },

  countdownWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  countdownLabel: { color: '#888', fontSize: 14, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 },
  countdownValue: { fontSize: 200, fontWeight: '900', lineHeight: 220 },
  countdownSub:   { color: '#aaa', fontSize: 15, fontWeight: '600', marginTop: 16, textAlign: 'center' },
});
