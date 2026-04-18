import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity,
  Dimensions, Modal,
} from 'react-native';
import useStore from '../store/useStore';
import useColors from '../lib/useColors';
import { getLevelInfo } from '../lib/xp';

const { width, height } = Dimensions.get('window');

const PARTICLE_COUNT = 20;
const COLORS_LIST = ['#ff4d00', '#ff8c00', '#ffd700', '#ff6b6b', '#fff'];

function randomBetween(a, b) { return a + Math.random() * (b - a); }

// ── Single confetti particle ──────────────────────────────────────────────────
function Particle({ delay }) {
  const startX = useRef(randomBetween(0, width)).current;
  const y      = useRef(new Animated.Value(-20)).current;
  const rot    = useRef(new Animated.Value(0)).current;
  const op     = useRef(new Animated.Value(1)).current;
  const color  = COLORS_LIST[Math.floor(Math.random() * COLORS_LIST.length)];
  const size   = randomBetween(6, 12);

  useEffect(() => {
    const targetY = randomBetween(height * 0.3, height * 0.85);
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(y,   { toValue: targetY, duration: 1800, useNativeDriver: true }),
        Animated.timing(rot, { toValue: randomBetween(360, 720), duration: 1800, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(1200),
          Animated.timing(op, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: 0,
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: color,
        opacity: op,
        transform: [
          { translateY: y },
          { rotate: rot.interpolate({ inputRange: [0, 720], outputRange: ['0deg', '720deg'] }) },
        ],
      }}
    />
  );
}

// ── Main XP Popup ─────────────────────────────────────────────────────────────
export default function XPPopup() {
  const { xpEvent, clearXPEvent } = useStore();
  const colors  = useColors();
  const visible = !!xpEvent;

  const scaleAnim   = useRef(new Animated.Value(0.4)).current;
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const xpNumAnim   = useRef(new Animated.Value(0)).current;
  const levelAnim   = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!xpEvent) return;

    // Spawn particles
    setParticles(Array.from({ length: PARTICLE_COUNT }, (_, i) => i));

    // Reset animations
    scaleAnim.setValue(0.4);
    fadeAnim.setValue(0);
    xpNumAnim.setValue(0);
    levelAnim.setValue(0);

    const { newLevelInfo } = xpEvent;
    progressAnim.setValue(getLevelInfo(xpEvent.oldXP).progress);

    // Entrance animation
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    // Count up XP number
    Animated.timing(xpNumAnim, { toValue: xpEvent.amount, duration: 800, useNativeDriver: false }).start();

    // Animate progress bar to new position
    Animated.timing(progressAnim, {
      toValue: newLevelInfo.progress,
      duration: 1000,
      delay: 400,
      useNativeDriver: false,
    }).start();

    // Level up badge animation
    if (xpEvent.leveledUp) {
      Animated.sequence([
        Animated.delay(600),
        Animated.spring(levelAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      ]).start();
    }

    // Auto dismiss after 3.5 seconds
    const timer = setTimeout(() => dismiss(), 3500);
    return () => clearTimeout(timer);
  }, [xpEvent]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.8, duration: 200, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 0,   duration: 200, useNativeDriver: true }),
    ]).start(() => {
      clearXPEvent();
      setParticles([]);
    });
  };

  if (!xpEvent) return null;

  const { amount, newXP, leveledUp, newLevelInfo } = xpEvent;
  const { current, next, xpIntoLevel, xpForNextLevel } = newLevelInfo;

  const xpDisplay = xpNumAnim.interpolate({
    inputRange: [0, amount],
    outputRange: ['0', String(amount)],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={dismiss}>

        {/* Confetti */}
        {particles.map(i => <Particle key={i} delay={i * 40} />)}

        {/* Card */}
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.surface, transform: [{ scale: scaleAnim }], opacity: fadeAnim },
          ]}
        >
          {/* XP Amount */}
          <View style={[styles.xpCircle, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '44' }]}>
            <Text style={styles.xpPlus}>+</Text>
            <Animated.Text style={[styles.xpNumber, { color: colors.accent }]}>
              {xpDisplay}
            </Animated.Text>
            <Text style={[styles.xpLabel, { color: colors.accent }]}>XP</Text>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {leveledUp ? 'LEVEL UP! 🎉' : 'Workout Complete! 💪'}
          </Text>

          <Text style={[styles.subtitle, { color: colors.text2 }]}>
            {leveledUp
              ? `You reached ${current.emoji} ${current.title}`
              : `Keep grinding — you're on your way to ${current.title}`
            }
          </Text>

          {/* Level Up Badge */}
          {leveledUp && (
            <Animated.View
              style={[
                styles.levelUpBadge,
                { backgroundColor: colors.accent, transform: [{ scale: levelAnim }] },
              ]}
            >
              <Text style={styles.levelUpEmoji}>{current.emoji}</Text>
              <Text style={styles.levelUpText}>Level {current.level} — {current.title}</Text>
            </Animated.View>
          )}

          {/* XP Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabels}>
              <Text style={[styles.progressLevelText, { color: colors.text3 }]}>
                Lv.{current.level} {current.title}
              </Text>
              {next && (
                <Text style={[styles.progressLevelText, { color: colors.text3 }]}>
                  Lv.{next.level} {next.title}
                </Text>
              )}
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <Animated.View
                style={[styles.progressFill, { backgroundColor: colors.accent, width: progressWidth }]}
              />
            </View>
            <Text style={[styles.progressXPText, { color: colors.text3 }]}>
              {next
                ? `${xpIntoLevel.toLocaleString()} / ${xpForNextLevel.toLocaleString()} XP`
                : `${newXP.toLocaleString()} XP — MAX LEVEL 👑`
              }
            </Text>
          </View>

          <Text style={[styles.tapToContinue, { color: colors.text3 }]}>
            Tap anywhere to continue
          </Text>
        </Animated.View>

      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  card:            { width: width * 0.85, borderRadius: 28, padding: 28, alignItems: 'center', gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20 },

  xpCircle:        { width: 120, height: 120, borderRadius: 60, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  xpPlus:          { fontSize: 22, fontWeight: '900', color: '#ff4d00', position: 'absolute', top: 18, left: 22 },
  xpNumber:        { fontSize: 44, fontWeight: '900', lineHeight: 48 },
  xpLabel:         { fontSize: 16, fontWeight: '800', letterSpacing: 2, marginTop: -4 },

  title:           { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  subtitle:        { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  levelUpBadge:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 12 },
  levelUpEmoji:    { fontSize: 22 },
  levelUpText:     { fontSize: 15, fontWeight: '800', color: '#fff' },

  progressSection: { width: '100%', gap: 6 },
  progressLabels:  { flexDirection: 'row', justifyContent: 'space-between' },
  progressLevelText:{ fontSize: 11, fontWeight: '700' },
  progressTrack:   { height: 10, borderRadius: 5, width: '100%', overflow: 'hidden' },
  progressFill:    { height: 10, borderRadius: 5 },
  progressXPText:  { fontSize: 12, textAlign: 'center', fontWeight: '600' },

  tapToContinue:   { fontSize: 12, marginTop: 4 },
});
