import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Modal, ActivityIndicator, Alert, TextInput,
  KeyboardAvoidingView, Platform, Share, Linking, BackHandler,
  Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import useStore from '../store/useStore';
import { XP_REWARDS } from '../lib/xp';
import { EXERCISES, SAMPLE_ROUTINES } from '../data/exercises';
import { TUTORIALS } from '../data/exerciseTutorials';
import useColors from '../lib/useColors';
import { shadow } from '../lib/theme';
import HeaderActions from '../components/HeaderActions';
import { supabase } from '../lib/supabase';
import { shareWorkout } from '../lib/community';

const { width } = Dimensions.get('window');

/* Build a name-based fallback index so AI-generated exercises (no numeric ID) also get tutorials */
const TUTORIALS_BY_NAME = {};
EXERCISES.forEach(ex => {
  if (TUTORIALS[ex.id]) {
    TUTORIALS_BY_NAME[ex.name.toLowerCase()] = TUTORIALS[ex.id];
  }
});
const getTutorial = ex => TUTORIALS[ex?.id] || TUTORIALS_BY_NAME[ex?.name?.toLowerCase()] || null;

/* ─── Helpers ─── */
const fmtTime = s => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`;
};
const fmtDist = km => km >= 1 ? `${km.toFixed(2)} km` : `${(km * 1000).toFixed(0)} m`;
const fmtPace = mins => {
  if (!mins || !isFinite(mins) || mins <= 0 || mins > 99) return '—';
  const m = Math.floor(mins);
  const s = Math.round((mins - m) * 60);
  return `${m}:${String(s).padStart(2,'0')}`;
};
const todayStr = () => new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateCals(sec, wKg, level) {
  const met = level === 'Advanced' ? 6 : level === 'Intermediate' ? 4.5 : 3.5;
  return Math.round(met * (wKg || 70) * (sec / 3600));
}

function resolveExercises(r) {
  if (!r?.exercises?.length) return [];
  if (typeof r.exercises[0] === 'object') return r.exercises;
  return r.exercises.map(id => EXERCISES.find(e => e.id === id)).filter(Boolean);
}

const diffColor = d => d === 'Advanced' ? '#ef4444' : d === 'Intermediate' ? '#f97316' : '#10b981';
const diffBg    = d => d === 'Advanced' ? '#fef2f2' : d === 'Intermediate' ? '#fff7ed' : '#f0fdf4';

const GPS_ACTS = [
  { id: 'run',  label: 'Run',  color: '#ff4d00' },
  { id: 'bike', label: 'Bike', color: '#3b82f6' },
  { id: 'walk', label: 'Walk', color: '#10b981' },
  { id: 'hike', label: 'Hike', color: '#8b5cf6' },
];

const CATEGORIES = [
  { id: 'Chest',      color: '#ef4444' },
  { id: 'Back',       color: '#3b82f6' },
  { id: 'Legs',       color: '#8b5cf6' },
  { id: 'Shoulders',  color: '#f59e0b' },
  { id: 'Biceps',     color: '#10b981' },
  { id: 'Triceps',    color: '#f97316' },
  { id: 'Core',       color: '#06b6d4' },
  { id: 'Glutes',     color: '#ec4899' },
  { id: 'Hamstrings', color: '#7c3aed' },
  { id: 'Full Body',  color: '#ff4d00' },
  { id: 'Calves',     color: '#0ea5e9' },
  { id: 'Forearms',   color: '#6366f1' },
];

/* ─── Tutorial Modal ─── */
function TutorialModal({ ex, onClose }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!ex) return null;
  const tutorial = getTutorial(ex);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayDismiss} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.tutorialEmojiWrap}>
              <Text style={styles.tutorialEmoji}>{tutorial?.emoji || '💪'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>{ex.name}</Text>
              <Text style={styles.sheetSub}>{ex.muscle}{ex.type ? ` · ${ex.type}` : ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.sheetCloseX}>
              <Text style={styles.sheetCloseXText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            {tutorial ? (
              <>
                <View style={styles.tutorialMeta}>
                  <View style={styles.tutorialPill}>
                    <Text style={styles.tutorialPillIcon}>🎯</Text>
                    <Text style={styles.tutorialPillText}>{tutorial.muscles}</Text>
                  </View>
                  <View style={styles.tutorialPill}>
                    <Text style={styles.tutorialPillIcon}>🏋️</Text>
                    <Text style={styles.tutorialPillText}>{tutorial.equipment}</Text>
                  </View>
                </View>
                <View style={styles.instructions}>
                  <Text style={styles.instructionsTitle}>How to do it</Text>
                  {tutorial.steps.map((step, i) => (
                    <View key={i} style={styles.step}>
                      <View style={styles.stepNum}><Text style={styles.stepNumText}>{i + 1}</Text></View>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}
                </View>
                {tutorial.tip ? (
                  <View style={styles.tipCard}>
                    <Text style={styles.tipIcon}>💡</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tipLabel}>Pro Tip</Text>
                      <Text style={styles.tipText}>{tutorial.tip}</Text>
                    </View>
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.gifPlaceholder}>
                <Text style={{ fontSize: 44, marginBottom: 12 }}>💪</Text>
                <Text style={styles.gifNote}>{ex.name}</Text>
                <Text style={styles.gifSub}>Tutorial coming soon for this exercise.</Text>
              </View>
            )}
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Main Track Screen ─── */
export default function TrackScreen({ route }) {
  const { user, routines, logs, addLog, addXP } = useStore();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Handle routine passed from Routines tab
  React.useEffect(() => {
    if (route?.params?.startRoutine) {
      startStrength(route.params.startRoutine);
    }
  }, [route?.params?.startRoutine]);

  /* ─ Core state ─ */
  const [mode, setMode]           = useState('home');
  const [selR, setSelR]           = useState(null);
  const [sets, setSets]           = useState({});
  const [elapsed, setElapsed]     = useState(0);
  const [paused, setPaused]       = useState(false);
  const [gpsAct, setGpsAct]       = useState('run');
  const [gpsDist, setGpsDist]     = useState(0);
  const [gpsErr, setGpsErr]       = useState(null);
  const [gpsSignal, setGpsSignal] = useState('acquiring');
  const [tutorialEx, setTutorialEx] = useState(null);
  const [shareModal, setShareModal] = useState(false);
  const [shareCaption, setShareCaption] = useState('');
  const [sharePosting, setSharePosting] = useState(false);
  const [shareData, setShareData]   = useState(null);

  /* ─ New: workout builder + category browse ─ */
  const [builderExs, setBuilderExs] = useState([]);
  const [selCategory, setSelCategory] = useState(null);
  const [countdownNum, setCountdownNum] = useState(3);

  /* ─ GPS pace tracking ─ */
  const [currentPace, setCurrentPace] = useState(null);
  const paceBufferRef = useRef([]); // rolling 30-sec window of {dist, time}

  /* ─ Refs ─ */
  const timerRef    = useRef(null);
  const watchRef    = useRef(null);
  const distRef     = useRef(0);
  const lastPosRef  = useRef(null);
  const pausedRef   = useRef(false);
  const modeRef     = useRef(mode);
  const countdownAnim = useRef(new Animated.Value(1)).current;

  // Keep modeRef in sync for GPS callback closure
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const curAct  = GPS_ACTS.find(a => a.id === gpsAct);
  const allRoutines = [...SAMPLE_ROUTINES, ...routines];
  const aiRoutines  = allRoutines.filter(r => r.generated);
  const exs = selR ? resolveExercises(selR) : [];
  const totalSets = exs.reduce((s, e) => s + (typeof e.sets === 'number' ? e.sets : 3), 0);
  const doneSets  = Object.values(sets).filter(Boolean).length;
  const wKg  = user?.units === 'imperial' ? (parseFloat(user?.weight) || 154) / 2.205 : (parseFloat(user?.weight) || 70);
  const strCal = estimateCals(elapsed, wKg, user?.level);
  const met    = gpsAct === 'bike' ? 6 : gpsAct === 'walk' ? 3.5 : gpsAct === 'hike' ? 5.3 : 8;
  const gpsCal = Math.round(met * wKg * (elapsed / 3600));

  // Sync pausedRef
  useEffect(() => {
    const was = pausedRef.current;
    pausedRef.current = paused;
    if (was && !paused) lastPosRef.current = null;
  }, [paused]);

  // Timer — only runs during active workout/GPS
  useEffect(() => {
    if ((mode === 'str-active' || mode === 'gps-active') && !paused) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [mode, paused]);

  // GPS watch — starts on gps-setup, keeps running through countdown + active, stops on non-GPS modes
  useEffect(() => {
    const GPS_MODES = ['gps-setup', 'gps-countdown', 'gps-active'];

    if (!GPS_MODES.includes(mode)) {
      watchRef.current?.remove();
      watchRef.current = null;
      lastPosRef.current = null;
      setGpsSignal('acquiring');
      return;
    }

    // Already watching (switching between GPS modes) — don't restart
    if (watchRef.current) return;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsErr('Location permission denied — enable it in Settings');
        setGpsSignal('error');
        return;
      }
      setGpsErr(null);
      setGpsSignal('acquiring');
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 2 },
        pos => {
          setGpsSignal('active');
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          // Only accumulate distance when actively running (not setup/countdown)
          if (modeRef.current === 'gps-active' && !pausedRef.current && lastPosRef.current) {
            const d = haversine(lastPosRef.current.lat, lastPosRef.current.lng, newPos.lat, newPos.lng);
            if (d < 0.1) { distRef.current += d; setGpsDist(distRef.current); }
          }
          if (modeRef.current === 'gps-active' && !pausedRef.current) {
            lastPosRef.current = newPos;
            // Rolling 30-second pace window
            const now = Date.now();
            paceBufferRef.current.push({ dist: distRef.current, time: now });
            paceBufferRef.current = paceBufferRef.current.filter(p => now - p.time <= 30000);
            if (paceBufferRef.current.length >= 2) {
              const oldest = paceBufferRef.current[0];
              const distDelta = distRef.current - oldest.dist; // km
              const timeDelta = (now - oldest.time) / 60000;  // minutes
              if (distDelta > 0.005) setCurrentPace(timeDelta / distDelta);
            }
          }
        }
      );
    })();
  }, [mode]);

  // GPS countdown: 3 → 2 → 1 → GO (enters gps-active)
  useEffect(() => {
    if (mode !== 'gps-countdown') return;
    setCountdownNum(3);
    countdownAnim.setValue(0.2);
    Animated.spring(countdownAnim, { toValue: 1, tension: 180, friction: 7, useNativeDriver: true }).start();

    const t1 = setTimeout(() => {
      setCountdownNum(2);
      countdownAnim.setValue(0.2);
      Animated.spring(countdownAnim, { toValue: 1, tension: 180, friction: 7, useNativeDriver: true }).start();
    }, 1000);
    const t2 = setTimeout(() => {
      setCountdownNum(1);
      countdownAnim.setValue(0.2);
      Animated.spring(countdownAnim, { toValue: 1, tension: 180, friction: 7, useNativeDriver: true }).start();
    }, 2000);
    const t3 = setTimeout(() => {
      setElapsed(0);
      distRef.current = 0;
      lastPosRef.current = null;
      setGpsDist(0);
      setMode('gps-active');
    }, 3000);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [mode]);

  const reset = () => {
    watchRef.current?.remove(); watchRef.current = null;
    clearInterval(timerRef.current);
    lastPosRef.current = null; distRef.current = 0;
    paceBufferRef.current = [];
    setMode('home'); setElapsed(0); setPaused(false);
    setSets({}); setSelR(null); setGpsDist(0);
    setGpsErr(null); setGpsSignal('acquiring');
    setCurrentPace(null);
  };

  const startStrength = r => { setSelR(r); setSets({}); setElapsed(0); setPaused(false); setMode('str-preview'); };

  // GPS now goes to setup mode first (waits for signal + user confirmation)
  const startGps = id => {
    setGpsAct(id);
    setElapsed(0);
    setGpsDist(0);
    distRef.current = 0;
    lastPosRef.current = null;
    setGpsSignal('acquiring');
    setMode('gps-setup');
  };

  const startBuilderWorkout = () => {
    if (builderExs.length === 0) return;
    const tempRoutine = {
      id: `builder-${Date.now()}`,
      name: 'My Workout',
      duration: builderExs.length * 4,
      exercises: builderExs,
      generated: false,
    };
    startStrength(tempRoutine);
  };

  const addToBuilder = (ex) => {
    setBuilderExs(prev => {
      if (prev.find(e => e.id === ex.id)) return prev; // already added
      return [...prev, { ...ex, sets: 3, reps: ex.reps || '10–12' }];
    });
  };

  const removeFromBuilder = (exId) => {
    setBuilderExs(prev => prev.filter(e => e.id !== exId));
  };

  const getCategoryExercises = (catId) => EXERCISES.filter(ex => ex.muscle === catId);

  // Intercept phone back button
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (mode === 'str-preview') { reset(); return true; }
        if (mode === 'category') { setMode('home'); return true; }
        if (mode === 'workout-builder') { setMode('home'); return true; }
        if (mode === 'gps-setup') { reset(); return true; }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [mode])
  );

  const openShare = (data) => {
    setShareData(data);
    setShareCaption('');
    setShareModal(true);
  };

  const handleShare = async () => {
    if (!shareData || sharePosting) return;
    setSharePosting(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) throw new Error('Not logged in');
      await shareWorkout({
        userId: authData.user.id,
        type: shareData.type,
        title: shareData.title,
        caption: shareCaption.trim(),
        workoutData: shareData.workoutData,
      });
      setShareModal(false);
      Alert.alert('Shared! 🎉', 'Your workout is now live on the Community feed.');
    } catch (e) {
      Alert.alert('Could not share', e.message || 'Please try again.');
    } finally {
      setSharePosting(false);
    }
  };

  const buildShareText = () => {
    if (!shareData) return '';
    const wd = shareData.workoutData || {};
    const stats = [
      wd.duration  ? `${wd.duration} min`  : null,
      wd.calories  ? `${wd.calories} cal`  : null,
      wd.distance  ? `${wd.distance} km`   : null,
    ].filter(Boolean).join(' · ');
    const caption = shareCaption.trim();
    return [
      `Just crushed "${shareData.title}" on AthloX! 💪`,
      stats,
      caption,
      '#AthloX #Fitness #Workout',
    ].filter(Boolean).join('\n');
  };

  const shareSocial = async (platform) => {
    const text = buildShareText();
    if (platform === 'x') {
      const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) Linking.openURL(url);
      else Alert.alert('X not available', 'Could not open X. Make sure the app is installed.');
      return;
    }
    try {
      await Share.share({ message: text });
    } catch (e) {
      if (e.message !== 'Share cancelled') Alert.alert('Could not share', e.message);
    }
  };

  const finishGps = () => {
    watchRef.current?.remove(); watchRef.current = null;
    setMode('gps-done');
    const isFirst = logs.length === 0;
    addLog({ id: Date.now(), date: todayStr(), ts: Date.now(), routine: `${curAct.label} — ${fmtDist(gpsDist)}`, duration: Math.round(elapsed / 60), calories: gpsCal, distance: +gpsDist.toFixed(2), type: 'cardio' });
    let xp = XP_REWARDS.LOG_RUN;
    if (isFirst) xp += XP_REWARDS.FIRST_WORKOUT;
    addXP(xp);
  };

  const finishStrength = () => {
    clearInterval(timerRef.current);
    setMode('str-done');
    const isFirst = logs.length === 0;
    addLog({ id: Date.now(), date: todayStr(), ts: Date.now(), routine: selR?.name || 'Workout', duration: Math.round(elapsed / 60), calories: strCal, type: 'strength' });
    let xp = XP_REWARDS.COMPLETE_WORKOUT;
    if (isFirst) xp += XP_REWARDS.FIRST_WORKOUT;
    addXP(xp);
  };

  /* ══════════════════════════════════════════════════════════════
     RENDER — GPS Done
  ══════════════════════════════════════════════════════════════ */
  if (mode === 'gps-done') return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { alignItems: 'center', paddingTop: 40 }]}>
        <View style={[styles.doneIcon, { backgroundColor: curAct.color }]}>
          <Text style={{ fontSize: 22, color: '#fff', fontWeight: '900' }}>✓</Text>
        </View>
        <Text style={styles.doneTitle}>Activity Complete</Text>
        <Text style={styles.doneSub}>{curAct.label} logged successfully</Text>
        <View style={styles.statsGrid}>
          {[
            [fmtDist(gpsDist), 'Distance'],
            [fmtTime(elapsed), 'Duration'],
            [`${gpsCal} kcal`, 'Calories'],
            [gpsDist > 0.01 ? `${fmtPace(elapsed / 60 / gpsDist)} /km` : '—', 'Avg Pace'],
          ].map(([v, l]) => (
            <View key={l} style={[styles.card, styles.statBox]}>
              <Text style={styles.statBoxVal}>{v}</Text>
              <Text style={styles.statBoxLabel}>{l}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.btnAccent, { marginBottom: 12 }]}
          onPress={() => openShare({
            type: curAct.id,
            title: `${curAct.label} — ${fmtDist(gpsDist)}`,
            workoutData: { duration: Math.round(elapsed / 60), calories: gpsCal, distance: +gpsDist.toFixed(2) },
          })}
        >
          <Text style={styles.btnAccentText}>📤 Share to Community</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} onPress={reset}><Text style={styles.closeBtnText}>Done</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  /* ══════════════════════════════════════════════════════════════
     RENDER — GPS Countdown (3-2-1)
  ══════════════════════════════════════════════════════════════ */
  if (mode === 'gps-countdown') return (
    <View style={styles.darkScreen}>
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={styles.countdownLabel}>Get Ready!</Text>
        <Animated.Text style={[styles.countdownNumber, { transform: [{ scale: countdownAnim }] }]}>
          {countdownNum}
        </Animated.Text>
        <Text style={styles.countdownSub}>{curAct.label.toUpperCase()} — GO!</Text>
      </SafeAreaView>
    </View>
  );

  /* ══════════════════════════════════════════════════════════════
     RENDER — GPS Setup (waiting for signal)
  ══════════════════════════════════════════════════════════════ */
  if (mode === 'gps-setup') return (
    <View style={styles.darkScreen}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Back */}
        <TouchableOpacity style={styles.setupBackBtn} onPress={reset}>
          <Text style={styles.setupBackText}>← Back</Text>
        </TouchableOpacity>

        {/* Activity info */}
        <View style={styles.setupHero}>
          <View style={[styles.setupActivityBadge, { backgroundColor: curAct.color + '22', borderColor: curAct.color + '55' }]}>
            <Text style={[styles.setupActivityBadgeText, { color: curAct.color }]}>{curAct.label.toUpperCase()}</Text>
          </View>
          <Text style={styles.setupTitle}>{curAct.label}</Text>
          <Text style={styles.setupSub}>GPS-tracked {curAct.label.toLowerCase()}</Text>
        </View>

        {/* GPS signal status */}
        <View style={[
          styles.setupSignalBox,
          gpsErr && { borderColor: 'rgba(239,68,68,0.4)' },
          gpsSignal === 'active' && { borderColor: 'rgba(16,185,129,0.35)' },
        ]}>
          {gpsErr ? (
            <>
              <Text style={{ fontSize: 28, marginBottom: 10 }}>⚠️</Text>
              <Text style={[styles.setupSignalText, { color: '#ef4444' }]}>Location denied</Text>
              <Text style={[styles.setupSignalHint, { color: '#888' }]}>Enable in Settings to track your route</Text>
            </>
          ) : gpsSignal === 'acquiring' ? (
            <>
              <ActivityIndicator color={colors.accent} size="large" style={{ marginBottom: 12 }} />
              <Text style={styles.setupSignalText}>Acquiring GPS signal…</Text>
              <Text style={styles.setupSignalHint}>Make sure you're outdoors or near a window</Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📍</Text>
              <Text style={[styles.setupSignalText, { color: '#10b981' }]}>GPS Ready</Text>
              <Text style={styles.setupSignalHint}>Signal locked — tap Start when ready</Text>
            </>
          )}
        </View>

        {/* Start button */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          <TouchableOpacity
            style={[
              styles.setupStartBtn,
              (gpsSignal !== 'active' || gpsErr) && styles.setupStartBtnDisabled,
            ]}
            onPress={() => gpsSignal === 'active' && !gpsErr && setMode('gps-countdown')}
            activeOpacity={gpsSignal === 'active' ? 0.85 : 1}
          >
            <Text style={styles.setupStartBtnText}>
              {gpsSignal === 'active' ? `▶  Start ${curAct.label}` : 'Waiting for GPS…'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );

  /* ══════════════════════════════════════════════════════════════
     RENDER — GPS Active
  ══════════════════════════════════════════════════════════════ */
  if (mode === 'gps-active') return (
    <View style={styles.darkScreen}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.gpsHeader}>
          <View style={[styles.gpsActPill, { backgroundColor: curAct.color + '22', borderColor: curAct.color + '44' }]}>
            <View style={[styles.gpsActDot, { backgroundColor: curAct.color }]} />
            <Text style={[styles.gpsActLabel, { color: curAct.color }]}>ACTIVE {curAct.label.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={[styles.gpsTimer, paused && { color: '#555' }]}>{fmtTime(elapsed)}</Text>
        {paused && <Text style={styles.pausedLabel}>⏸ Paused</Text>}

        {/* Row 1 — Distance · Avg Pace · Calories */}
        <View style={styles.gpsStats}>
          {[
            [fmtDist(gpsDist), 'Distance'],
            [fmtPace(gpsDist > 0.01 ? elapsed / 60 / gpsDist : null), 'Avg Pace'],
            [`${gpsCal}`, 'Calories'],
          ].map(([v, l]) => (
            <View key={l} style={styles.gpsStat}>
              <Text style={styles.gpsStatVal}>{v}</Text>
              <Text style={styles.gpsStatLabel}>{l}</Text>
            </View>
          ))}
        </View>

        {/* Row 2 — Current Pace · Heart Rate */}
        <View style={[styles.gpsStats, { marginBottom: 12 }]}>
          <View style={styles.gpsStat}>
            <Text style={[styles.gpsStatVal, currentPace && { color: colors.accent }]}>
              {fmtPace(currentPace)}
            </Text>
            <Text style={styles.gpsStatLabel}>Live Pace</Text>
          </View>
          <TouchableOpacity
            style={[styles.gpsStat, { flex: 2 }]}
            onPress={() => Alert.alert(
              '❤️ Heart Rate',
              'Connect an Apple Watch or Wear OS device to see live heart rate data.',
              [{ text: 'Got it' }]
            )}
            activeOpacity={0.75}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 16 }}>❤️</Text>
              <Text style={[styles.gpsStatVal, { color: '#f87171' }]}>— —</Text>
            </View>
            <Text style={styles.gpsStatLabel}>Heart Rate · bpm</Text>
          </TouchableOpacity>
        </View>

        {/* GPS signal pill */}
        <View style={styles.signalPill}>
          <View style={styles.signalDot} />
          <Text style={styles.signalPillText}>GPS Active · Tracking Route</Text>
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.btnGhost} onPress={() => setPaused(p => !p)}>
            <Text style={styles.btnGhostText}>{paused ? '▶ Resume' : '⏸ Pause'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnStop} onPress={finishGps}>
            <Text style={styles.btnStopText}>⏹ Stop</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );

  /* ══════════════════════════════════════════════════════════════
     RENDER — Strength Done
  ══════════════════════════════════════════════════════════════ */
  if (mode === 'str-done') return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { alignItems: 'center', paddingTop: 50 }]}>
        <View style={styles.doneIcon}><Text style={{ fontSize: 36 }}>✓</Text></View>
        <Text style={styles.doneTitle}>WORKOUT COMPLETE!</Text>
        <Text style={styles.doneSub}>You crushed it in {fmtTime(elapsed)}</Text>
        <View style={styles.doneStats}>
          {[['Duration', fmtTime(elapsed)], ['Est. Calories', `${strCal} kcal`]].map(([l, v]) => (
            <View key={l} style={[styles.card, styles.doneStatBox]}>
              <Text style={styles.doneStatLabel}>{l}</Text>
              <Text style={styles.doneStatVal}>{v}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.btnAccent, { marginBottom: 12 }]}
          onPress={() => openShare({
            type: 'workout',
            title: selR?.name || 'Strength Workout',
            workoutData: { duration: Math.round(elapsed / 60), calories: strCal },
          })}
        >
          <Text style={styles.btnAccentText}>📤 Share to Community</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} onPress={reset}><Text style={styles.closeBtnText}>Done</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  /* ══════════════════════════════════════════════════════════════
     RENDER — Strength Preview
  ══════════════════════════════════════════════════════════════ */
  if (mode === 'str-preview' && selR) return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.previewHeader}>
          <View style={styles.previewMeta}>
            <View style={[styles.previewIcon, { backgroundColor: (selR.color || colors.accent) + '22' }]}>
              <Text style={{ fontSize: 22 }}>{selR.generated ? '✨' : '💪'}</Text>
            </View>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.previewName}>{selR.name}</Text>
                {selR.generated && <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>}
              </View>
              <Text style={styles.previewSub}>{exs.length} exercises · ~{selR.duration} min</Text>
            </View>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Exercises in this routine</Text>
          <Text style={styles.sectionHint}>Tap ⓘ to see how it's done</Text>
          {exs.map((ex, idx) => {
            const ns = typeof ex.sets === 'number' ? ex.sets : 3;
            return (
              <View key={idx} style={[styles.card, styles.exRow]}>
                <View style={styles.exNum}><Text style={styles.exNumText}>{idx + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exName}>{ex.name}</Text>
                  <Text style={styles.exMeta}>{ex.muscle} · {ns} sets{ex.reps ? ` × ${ex.reps} reps` : ''}</Text>
                  {ex.note && <Text style={styles.exNote}>💡 {ex.note}</Text>}
                </View>
                <TouchableOpacity style={styles.infoBtn} onPress={() => setTutorialEx(ex)}>
                  <Text style={styles.infoBtnText}>ⓘ</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          <View style={{ height: 16 }} />
          <TouchableOpacity style={styles.btnAccent} onPress={() => { setSets({}); setElapsed(0); setPaused(false); setMode('str-active'); }}>
            <Text style={styles.btnAccentText}>▶ Start Workout</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.closeBtn, { marginTop: 10 }]} onPress={reset}>
            <Text style={styles.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
      <TutorialModal ex={tutorialEx} onClose={() => setTutorialEx(null)} />
    </View>
  );

  /* ══════════════════════════════════════════════════════════════
     RENDER — Strength Active
  ══════════════════════════════════════════════════════════════ */
  if (mode === 'str-active' && selR) {
    const pct = totalSets > 0 ? (doneSets / totalSets) * 100 : 0;
    return (
      <View style={styles.darkScreen}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.strHeader}>
            <View>
              <Text style={styles.strHeaderSub}>Active</Text>
              <Text style={styles.strHeaderTitle}>{selR.name.toUpperCase()}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.strTimer, paused && { color: '#555' }]}>{fmtTime(elapsed)}</Text>
              <Text style={styles.strProgress}>{doneSets}/{totalSets} sets · {strCal} cal</Text>
            </View>
          </View>
          {paused && <Text style={styles.pausedLabel}>⏸ PAUSED</Text>}
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <View style={[styles.actionRow, { paddingBottom: 8 }]}>
            <TouchableOpacity style={styles.btnGhost} onPress={() => setPaused(p => !p)}>
              <Text style={styles.btnGhostText}>{paused ? '▶ Resume' : '⏸ Pause'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnStop} onPress={finishStrength}>
              <Text style={styles.btnStopText}>⏹ Finish</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
            {exs.map((ex, idx) => {
              const k  = ex.id || `ex-${idx}`;
              const ns = typeof ex.sets === 'number' ? ex.sets : 3;
              return (
                <View key={k} style={styles.strExCard}>
                  <View style={styles.strExHeader}>
                    <View>
                      <Text style={styles.strExName}>{ex.name}</Text>
                      <Text style={styles.strExMuscle}>{ex.muscle}</Text>
                    </View>
                    {ex.reps && (
                      <View style={styles.repsBadge}>
                        <Text style={styles.repsBadgeText}>{ns}×{ex.reps}</Text>
                      </View>
                    )}
                  </View>
                  {ex.note && <Text style={styles.exNote}>{`💡 ${ex.note}`}</Text>}
                  <TouchableOpacity style={styles.howToBtn} onPress={() => setTutorialEx(ex)}>
                    <Text style={styles.howToBtnText}>ⓘ How to</Text>
                  </TouchableOpacity>
                  <View style={styles.setRow}>
                    {Array.from({ length: ns }, (_, n) => {
                      const sk = `${k}-${n}`;
                      const done = sets[sk];
                      return (
                        <TouchableOpacity
                          key={n}
                          style={[styles.setBtn, done && styles.setBtnDone]}
                          onPress={() => !paused && setSets(p => ({ ...p, [sk]: !p[sk] }))}
                          disabled={paused}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.setBtnText, done && styles.setBtnTextDone]}>
                            {done ? '✓' : `Set ${n + 1}`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
        <TutorialModal ex={tutorialEx} onClose={() => setTutorialEx(null)} />
      </View>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER — Exercise Category Browse
  ══════════════════════════════════════════════════════════════ */
  if (mode === 'category' && selCategory) {
    const catExercises = getCategoryExercises(selCategory);
    const cat = CATEGORIES.find(c => c.id === selCategory);
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.catHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setMode('home')} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.catHeaderAccent, { backgroundColor: cat?.color || colors.accent }]} />
              <Text style={styles.catHeaderTitle}>{selCategory}</Text>
            </View>
            <Text style={styles.catHeaderSub}>{catExercises.length} exercises</Text>
          </View>
          {builderExs.length > 0 && (
            <TouchableOpacity onPress={() => setMode('workout-builder')} style={[styles.builderPill, { backgroundColor: colors.accent }]}>
              <Text style={styles.builderPillText}>{builderExs.length} ▸</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 12, paddingBottom: builderExs.length > 0 ? 100 : 24 }]} showsVerticalScrollIndicator={false}>
          {catExercises.length === 0 ? (
            <View style={[styles.card, { padding: 24, alignItems: 'center' }]}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>🏗️</Text>
              <Text style={[styles.routineName, { textAlign: 'center' }]}>Coming soon</Text>
              <Text style={[styles.routineMeta, { textAlign: 'center', marginTop: 4 }]}>
                More exercises are being added to this category.
              </Text>
            </View>
          ) : (
            catExercises.map(ex => {
              const isAdded = builderExs.some(e => e.id === ex.id);
              return (
                <View key={ex.id} style={[styles.card, styles.catExRow]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exName}>{ex.name}</Text>
                    <View style={styles.catExMeta}>
                      <Text style={styles.exMeta}>{ex.muscle} · {ex.type}</Text>
                      <View style={[styles.diffBadge, { backgroundColor: diffBg(ex.difficulty) }]}>
                        <Text style={[styles.diffText, { color: diffColor(ex.difficulty) }]}>{ex.difficulty}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <TouchableOpacity style={styles.infoBtn} onPress={() => setTutorialEx(ex)}>
                      <Text style={styles.infoBtnText}>ⓘ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.addExBtn, isAdded && styles.addExBtnDone]}
                      onPress={() => isAdded ? removeFromBuilder(ex.id) : addToBuilder(ex)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.addExBtnText, isAdded && styles.addExBtnTextDone]}>
                        {isAdded ? '✓' : '+'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Floating builder bar */}
        {builderExs.length > 0 && (
          <View style={[styles.floatingBar, { backgroundColor: colors.accent }]}>
            <Text style={styles.floatingBarText}>{builderExs.length} exercise{builderExs.length !== 1 ? 's' : ''} added</Text>
            <TouchableOpacity onPress={() => setMode('workout-builder')} style={styles.floatingBarBtn}>
              <Text style={styles.floatingBarBtnText}>View Workout →</Text>
            </TouchableOpacity>
          </View>
        )}

        <TutorialModal ex={tutorialEx} onClose={() => setTutorialEx(null)} />
      </SafeAreaView>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER — Workout Builder
  ══════════════════════════════════════════════════════════════ */
  if (mode === 'workout-builder') return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.catHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setMode('home')} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.catHeaderTitle}>My Workout</Text>
          <Text style={styles.catHeaderSub}>{builderExs.length} exercises</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Clear Workout?', 'This will remove all exercises.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Clear', style: 'destructive', onPress: () => { setBuilderExs([]); setMode('home'); } },
            ]);
          }}
          style={styles.clearBtn}
        >
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 12, paddingBottom: 140 }]} showsVerticalScrollIndicator={false}>
        {builderExs.length === 0 ? (
          <View style={[styles.card, { padding: 28, alignItems: 'center', marginTop: 20 }]}>
            <Text style={{ fontSize: 42, marginBottom: 12 }}>🏋️</Text>
            <Text style={styles.routineName}>No exercises yet</Text>
            <Text style={[styles.routineMeta, { textAlign: 'center', marginTop: 6 }]}>
              Browse categories below and add exercises to build your workout.
            </Text>
          </View>
        ) : (
          builderExs.map((ex, idx) => (
            <View key={ex.id || idx} style={[styles.card, styles.builderRow]}>
              <View style={styles.exNum}>
                <Text style={styles.exNumText}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.exName}>{ex.name}</Text>
                <Text style={styles.exMeta}>{ex.muscle} · 3 sets × {ex.reps || '10–12'} reps</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.infoBtn} onPress={() => setTutorialEx(ex)}>
                  <Text style={styles.infoBtnText}>ⓘ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.infoBtn, { borderColor: '#fca5a5' }]}
                  onPress={() => removeFromBuilder(ex.id)}
                >
                  <Text style={{ fontSize: 16, color: '#ef4444' }}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Add more exercises */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Add More Exercises</Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => { setSelCategory(cat.id); setMode('category'); }}
              activeOpacity={0.75}
            >
              <View style={[styles.catAccentBar, { backgroundColor: cat.color }]} />
              <Text style={[styles.catItemLabel, { color: colors.text, flex: 1 }]}>{cat.id}</Text>
              <Text style={[styles.chevron, { marginRight: 4 }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Start Workout button */}
      {builderExs.length > 0 && (
        <View style={[styles.startBar, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
          <TouchableOpacity style={styles.btnAccent} onPress={startBuilderWorkout}>
            <Text style={styles.btnAccentText}>▶  Start Workout ({builderExs.length} exercises)</Text>
          </TouchableOpacity>
        </View>
      )}

      <TutorialModal ex={tutorialEx} onClose={() => setTutorialEx(null)} />
    </SafeAreaView>
  );

  /* ══════════════════════════════════════════════════════════════
     Share Modal (used across multiple done screens)
  ══════════════════════════════════════════════════════════════ */
  const ShareModal = (
    <Modal visible={shareModal} transparent animationType="slide" onRequestClose={() => setShareModal(false)}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setShareModal(false)} />
        <View style={styles.shareSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.shareTitle}>Share Your Workout</Text>
          <Text style={styles.shareSubtitle}>{shareData?.title}</Text>
          <TextInput
            style={styles.shareInput}
            placeholder="Add a caption… (optional)"
            placeholderTextColor={colors.text3}
            value={shareCaption}
            onChangeText={setShareCaption}
            multiline
            maxLength={280}
            autoFocus
          />
          <TouchableOpacity
            style={[styles.btnAccent, sharePosting && { opacity: 0.6 }]}
            onPress={handleShare}
            disabled={sharePosting}
            activeOpacity={0.85}
          >
            {sharePosting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnAccentText}>📤 Post to Community</Text>
            }
          </TouchableOpacity>
          <Text style={styles.shareDividerText}>Also share on</Text>
          <View style={styles.socialRow}>
            <TouchableOpacity style={[styles.socialShareBtn, { backgroundColor: '#000' }]} onPress={() => shareSocial('x')} activeOpacity={0.85}>
              <Text style={styles.socialShareIcon}>𝕏</Text>
              <Text style={styles.socialShareLabel}>X</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.socialShareBtn, { backgroundColor: '#1877F2' }]} onPress={() => shareSocial('facebook')} activeOpacity={0.85}>
              <Text style={styles.socialShareIcon}>f</Text>
              <Text style={styles.socialShareLabel}>Facebook</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.socialShareBtn, { backgroundColor: '#E1306C' }]} onPress={() => shareSocial('instagram')} activeOpacity={0.85}>
              <Text style={styles.socialShareIcon}>📷</Text>
              <Text style={styles.socialShareLabel}>Instagram</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setShareModal(false)}>
            <Text style={styles.closeBtnText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  /* ══════════════════════════════════════════════════════════════
     RENDER — Home
  ══════════════════════════════════════════════════════════════ */
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Page header */}
        <View style={styles.screenHeader}>
          <View>
            <Text style={styles.pageTitle}>Workout</Text>
            <Text style={styles.pageSub}>What are we doing today?</Text>
          </View>
          <HeaderActions />
        </View>

        {/* ── Outdoor / Cardio ── */}
        <Text style={styles.sectionLabel}>Outdoor / Cardio</Text>
        <View style={styles.gpsGrid}>
          {GPS_ACTS.map(a => (
            <TouchableOpacity key={a.id} style={[styles.card, styles.gpsCard]} onPress={() => startGps(a.id)} activeOpacity={0.8}>
              <View style={[styles.gpsCardDot, { backgroundColor: a.color }]} />
              <Text style={styles.gpsCardLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Build a Workout ── */}
        <Text style={styles.sectionLabel}>Build a Workout</Text>
        {builderExs.length > 0 ? (
          <TouchableOpacity
            style={[styles.card, styles.builderBannerCard, { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.accentDim }]}
            onPress={() => setMode('workout-builder')}
            activeOpacity={0.85}
          >
            <View style={[styles.routineIcon, { backgroundColor: colors.accent + '22' }]}>
              <Text style={{ fontSize: 22 }}>🏋️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routineName}>My Workout</Text>
              <Text style={styles.routineMeta}>{builderExs.length} exercises added · Tap to edit</Text>
            </View>
            <TouchableOpacity
              style={[styles.startSmallBtn, { backgroundColor: colors.accent }]}
              onPress={startBuilderWorkout}
            >
              <Text style={styles.startSmallBtnText}>▶ Start</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.card, styles.builderPromptCard]}
            onPress={() => setMode('workout-builder')}
            activeOpacity={0.85}
          >
            <Text style={styles.builderPromptTitle}>Create Your Workout</Text>
            <Text style={styles.builderPromptSub}>Browse categories, add exercises, then start</Text>
          </TouchableOpacity>
        )}

        {/* ── Exercise Library ── */}
        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Exercise Library</Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => { setSelCategory(cat.id); setMode('category'); }}
              activeOpacity={0.75}
            >
              <View style={[styles.catAccentBar, { backgroundColor: cat.color }]} />
              <Text style={[styles.catItemLabel, { color: colors.text, flex: 1 }]}>{cat.id}</Text>
              <Text style={[styles.chevron, { marginRight: 4 }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── AI Routines (if any) ── */}
        {aiRoutines.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>AI Generated For You</Text>
            {aiRoutines.map(r => (
              <TouchableOpacity
                key={r.id}
                style={[styles.card, styles.routineCard, { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.accentDim }]}
                onPress={() => startStrength(r)}
                activeOpacity={0.85}
              >
                <View style={[styles.routineIcon, { backgroundColor: (r.color || colors.accent) + '22' }]}>
                  <Text style={{ fontSize: 22 }}>✨</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.routineName}>{r.name}</Text>
                    <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>
                  </View>
                  <Text style={styles.routineMeta}>{resolveExercises(r).length} exercises · ~{r.duration} min</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

      </ScrollView>
      <TutorialModal ex={tutorialEx} onClose={() => setTutorialEx(null)} />
      {ShareModal}
    </SafeAreaView>
  );
}

/* ══════════════════════════════════════════════════════════════
   STYLES
══════════════════════════════════════════════════════════════ */
const makeStyles = (colors) => StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.bg },
  scroll:          { paddingHorizontal: 16, paddingBottom: 24 },
  card:            { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, ...shadow.card },

  // Home
  screenHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingBottom: 4 },
  pageTitle:       { fontSize: 34, fontWeight: '900', color: colors.text },
  pageSub:         { fontSize: 14, color: colors.text2, marginTop: 4, marginBottom: 20 },
  sectionLabel:    { fontSize: 11, fontWeight: '700', color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },
  sectionHint:     { fontSize: 12, color: colors.text3, marginBottom: 12, marginTop: -6 },

  // GPS grid
  gpsGrid:         { flexDirection: 'row', gap: 8, marginBottom: 24 },
  gpsCard:         { flex: 1, padding: 14, alignItems: 'center', minHeight: 74, gap: 8 },
  gpsCardDot:      { width: 10, height: 10, borderRadius: 5 },
  gpsCardLabel:    { fontSize: 12, fontWeight: '700', color: colors.text },

  // Routines
  routineCard:     { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, marginBottom: 10 },
  routineIcon:     { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  routineName:     { fontSize: 15, fontWeight: '700', color: colors.text },
  routineMeta:     { fontSize: 12, color: colors.text2, marginTop: 2 },
  chevron:         { fontSize: 22, color: colors.text3 },

  // Builder banner / prompt on home
  builderBannerCard:  { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, marginBottom: 16 },
  builderPromptCard:  { padding: 24, alignItems: 'center', marginBottom: 8 },
  builderPromptTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 4 },
  builderPromptSub:   { fontSize: 13, color: colors.text2, textAlign: 'center' },
  startSmallBtn:      { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  startSmallBtnText:  { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Category grid
  catGrid:         { gap: 8, marginBottom: 24 },
  catItem:         { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  catAccentBar:    { width: 4, alignSelf: 'stretch' },
  catItemLabel:    { fontSize: 15, fontWeight: '700', paddingVertical: 16, paddingLeft: 14 },

  // Category browse screen
  catHeader:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  catHeaderAccent: { width: 4, height: 20, borderRadius: 2 },
  catHeaderTitle:  { fontSize: 17, fontWeight: '800', color: colors.text },
  catHeaderSub:    { fontSize: 12, color: colors.text2, marginTop: 2 },
  catExRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 8 },
  catExMeta:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  diffBadge:       { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  diffText:        { fontSize: 10, fontWeight: '700' },
  addExBtn:        { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accent + '18', borderWidth: 1.5, borderColor: colors.accent + '44', alignItems: 'center', justifyContent: 'center' },
  addExBtnDone:    { backgroundColor: colors.accent, borderColor: colors.accent },
  addExBtnText:    { fontSize: 20, fontWeight: '700', color: colors.accent },
  addExBtnTextDone:{ color: '#fff' },
  builderPill:     { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  builderPillText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Floating bar (category browse)
  floatingBar:     { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 32 },
  floatingBarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  floatingBarBtn:  { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  floatingBarBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Workout builder screen
  builderRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 8 },
  clearBtn:        { paddingHorizontal: 12, paddingVertical: 6 },
  clearBtnText:    { fontSize: 14, color: '#ef4444', fontWeight: '600' },
  startBar:        { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 28, borderTopWidth: 1 },

  // Shared buttons
  btnAccent:       { backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 17, alignItems: 'center', width: '100%', shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  btnAccentText:   { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Back button
  backBtn:         { paddingRight: 12, paddingVertical: 4 },
  backText:        { fontSize: 15, fontWeight: '600', color: colors.text2 },

  // Dark screen (GPS + Strength active)
  darkScreen:      { flex: 1, backgroundColor: '#0d0d0d' },
  actionRow:       { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  btnGhost:        { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  btnGhostText:    { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnStop:         { flex: 1, backgroundColor: colors.red, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnStopText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
  pausedLabel:     { textAlign: 'center', fontSize: 12, color: colors.accent, fontWeight: '700', marginBottom: 4 },

  // GPS Setup screen
  setupBackBtn:    { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  setupBackText:   { fontSize: 15, fontWeight: '600', color: '#888' },
  setupHero:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  setupTitle:      { fontSize: 36, fontWeight: '900', color: '#fff' },
  setupSub:        { fontSize: 14, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8 },
  setupSignalBox:  { marginHorizontal: 20, borderRadius: 20, paddingVertical: 28, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', marginBottom: 20, gap: 4 },
  setupSignalText: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 4 },
  setupSignalHint: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 4 },
  setupStartBtn:   { backgroundColor: colors.accent, borderRadius: 18, paddingVertical: 18, alignItems: 'center', shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },
  setupStartBtnDisabled: { backgroundColor: '#333', shadowOpacity: 0 },
  setupStartBtnText:    { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  setupActivityBadge:   { borderRadius: 12, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 10, marginBottom: 16 },
  setupActivityBadgeText: { fontSize: 13, fontWeight: '800', letterSpacing: 2 },

  // GPS Countdown screen
  countdownLabel:  { fontSize: 18, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 20, textAlign: 'center' },
  countdownNumber: { fontSize: 160, fontWeight: '900', color: '#fff', textAlign: 'center', lineHeight: 180 },
  countdownSub:    { fontSize: 16, color: '#888', textAlign: 'center', marginTop: 8 },

  // GPS Active
  gpsHeader:       { alignItems: 'center', paddingTop: 28 },
  gpsActPill:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  gpsActDot:       { width: 8, height: 8, borderRadius: 4 },
  gpsActLabel:     { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  gpsTimer:        { fontFamily: 'monospace', fontSize: 60, fontWeight: '700', color: '#fff', textAlign: 'center', letterSpacing: -2, marginVertical: 16 },
  gpsStats:        { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  gpsStat:         { flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 13, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  gpsStatVal:      { fontSize: 18, fontWeight: '700', color: '#fff' },
  gpsStatLabel:    { fontSize: 10, color: '#888', textTransform: 'uppercase', marginTop: 4 },
  signalBox:       { marginHorizontal: 16, borderRadius: 16, height: 90, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  signalText:      { fontSize: 12, color: '#888' },
  signalPill:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginBottom: 16, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 20, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)' },
  signalDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  signalPillText:  { fontSize: 12, color: '#10b981', fontWeight: '600' },

  // Strength Active
  strHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  strHeaderSub:    { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8 },
  strHeaderTitle:  { fontSize: 24, fontWeight: '900', color: '#fff' },
  strTimer:        { fontSize: 30, fontWeight: '700', color: colors.accent, fontFamily: 'monospace' },
  strProgress:     { fontSize: 12, color: '#888', marginTop: 2 },
  progressBg:      { marginHorizontal: 16, marginBottom: 12, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
  progressFill:    { height: 4, backgroundColor: colors.accent, borderRadius: 2 },
  strExCard:       { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 10 },
  strExHeader:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  strExName:       { fontSize: 15, fontWeight: '700', color: '#fff' },
  strExMuscle:     { fontSize: 12, color: '#888' },
  repsBadge:       { backgroundColor: 'rgba(255,77,0,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  repsBadgeText:   { fontSize: 11, color: colors.accent, fontWeight: '600' },
  howToBtn:        { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 10 },
  howToBtnText:    { fontSize: 12, color: '#aaa' },
  setRow:          { flexDirection: 'row', gap: 8 },
  setBtn:          { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  setBtnDone:      { backgroundColor: colors.accent, borderColor: colors.accent },
  setBtnText:      { fontSize: 13, fontWeight: '600', color: '#888' },
  setBtnTextDone:  { color: '#fff' },

  // Preview
  previewHeader:   { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, padding: 16 },
  previewMeta:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewIcon:     { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  previewName:     { fontSize: 22, fontWeight: '900', color: colors.text },
  previewSub:      { fontSize: 13, color: colors.text2 },
  aiBadge:         { backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  aiBadgeText:     { fontSize: 10, color: '#fff', fontWeight: '700' },
  exRow:           { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, marginBottom: 8 },
  exNum:           { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  exNumText:       { fontSize: 13, fontWeight: '700', color: colors.accent },
  exName:          { fontSize: 14, fontWeight: '600', color: colors.text },
  exMeta:          { fontSize: 12, color: colors.text2, marginTop: 2 },
  exNote:          { fontSize: 11, color: colors.accent, marginTop: 3 },
  infoBtn:         { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  infoBtnText:     { fontSize: 14, color: colors.text2 },

  // Done screens
  doneTitle:       { fontSize: 34, fontWeight: '900', color: colors.text, marginTop: 16, textAlign: 'center' },
  doneSub:         { fontSize: 15, color: colors.text2, marginBottom: 24, textAlign: 'center' },
  doneIcon:        { width: 80, height: 80, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', shadowColor: colors.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  statsGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24, width: '100%' },
  statBox:         { width: '47%', padding: 14, alignItems: 'center' },
  statBoxVal:      { fontSize: 18, fontWeight: '700', color: colors.text },
  statBoxLabel:    { fontSize: 12, color: colors.text2, marginTop: 4 },
  doneStats:       { flexDirection: 'row', gap: 10, marginBottom: 24, width: '100%' },
  doneStatBox:     { flex: 1, padding: 16, alignItems: 'center' },
  doneStatLabel:   { fontSize: 11, color: colors.text3, textTransform: 'uppercase', marginBottom: 4 },
  doneStatVal:     { fontSize: 22, fontWeight: '700', color: colors.text },

  // Tutorial modal
  overlay:            { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  overlayDismiss:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet:              { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' },
  sheetHandle:        { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 14, marginBottom: 4 },
  sheetHeader:        { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  sheetCloseX:        { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  sheetCloseXText:    { fontSize: 13, color: colors.text3, fontWeight: '600' },
  tutorialEmojiWrap:  { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center' },
  tutorialEmoji:      { fontSize: 26 },
  sheetTitle:         { fontSize: 20, fontWeight: '700', color: colors.text },
  sheetSub:           { fontSize: 13, color: colors.text2, marginTop: 3 },
  tutorialMeta:       { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8, flexWrap: 'wrap' },
  tutorialPill:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bg, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border },
  tutorialPillIcon:   { fontSize: 13 },
  tutorialPillText:   { fontSize: 12, color: colors.text2, fontWeight: '500' },
  instructions:       { padding: 16 },
  instructionsTitle:  { fontSize: 13, fontWeight: '700', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  step:               { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
  stepNum:            { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  stepNumText:        { fontSize: 12, fontWeight: '800', color: '#fff' },
  stepText:           { flex: 1, fontSize: 14, color: colors.text, lineHeight: 22 },
  tipCard:            { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.accentDim, borderRadius: 14, padding: 14 },
  tipIcon:            { fontSize: 20, marginTop: 1 },
  tipLabel:           { fontSize: 11, fontWeight: '700', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  tipText:            { fontSize: 13, color: colors.text, lineHeight: 20 },
  gifPlaceholder:     { margin: 16, borderRadius: 16, backgroundColor: colors.bg, minHeight: 160, alignItems: 'center', justifyContent: 'center', padding: 24 },
  gifNote:            { fontSize: 14, color: colors.text2, marginTop: 8, fontWeight: '600' },
  gifSub:             { fontSize: 12, color: colors.text3, marginTop: 4, textAlign: 'center' },
  closeBtn:           { margin: 16, backgroundColor: colors.bg, borderRadius: 14, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  closeBtnText:       { fontSize: 15, fontWeight: '700', color: colors.text },

  // Share modal
  shareSheet:        { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  shareTitle:        { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 4, marginTop: 8 },
  shareSubtitle:     { fontSize: 14, color: colors.text2, textAlign: 'center', marginBottom: 16 },
  shareInput:        { backgroundColor: colors.bg, borderRadius: 14, padding: 14, fontSize: 15, color: colors.text, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  shareDividerText:  { fontSize: 12, fontWeight: '600', color: colors.text3, textAlign: 'center', marginTop: 16, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  socialRow:         { flexDirection: 'row', gap: 10, marginBottom: 16 },
  socialShareBtn:    { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 4 },
  socialShareIcon:   { fontSize: 20, color: '#fff' },
  socialShareLabel:  { fontSize: 11, color: '#fff', fontWeight: '600' },
});
