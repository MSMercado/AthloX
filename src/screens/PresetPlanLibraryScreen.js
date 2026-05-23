// v2.0 — Browse + start a curated preset plan.
// Reached from Plan tab hub → "Start new plan".
//
// Each row is a tappable preset card; tapping opens a confirm modal that
// lets the user start the plan. On confirm, we materialize the preset
// using the user's equipment + level and call setWorkoutPlan().

import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import useColors from '../lib/useColors';
import useStore from '../store/useStore';
import { PRESET_PLANS, materializePresetPlan } from '../data/presetPlans';

const LEVEL_COLOR = {
  beginner:     '#10b981',
  intermediate: '#3b82f6',
  advanced:     '#ef4444',
};

export default function PresetPlanLibraryScreen() {
  const colors = useColors();
  const navigation = useNavigation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, workoutPlan, setWorkoutPlan } = useStore();

  const [selectedPreset, setSelectedPreset] = useState(null);
  const [confirming,     setConfirming]     = useState(false);

  const meta = user?.user_metadata || {};
  const equipment = Array.isArray(meta.equipment) ? meta.equipment : [];
  const level     = (meta.level || 'beginner').toLowerCase();

  const handleStart = () => {
    if (!selectedPreset || confirming) return;
    setConfirming(true);
    try {
      const plan = materializePresetPlan(selectedPreset, { equipment, level });
      setWorkoutPlan(plan);
      setSelectedPreset(null);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not start plan', e?.message || 'Try again');
    } finally {
      setConfirming(false);
    }
  };

  const confirmReplace = () => {
    if (workoutPlan) {
      Alert.alert(
        'Replace your current plan?',
        `Starting "${selectedPreset.name}" will replace "${workoutPlan.planName}". Your workout history will be kept.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Replace', style: 'destructive', onPress: handleStart },
        ]
      );
    } else {
      handleStart();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.text }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Start new plan</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: colors.text2 }]}>
          Pick a ready-made plan curated by AthloX. Tap to read more, then start when you're ready.
        </Text>

        {PRESET_PLANS.map(preset => (
          <TouchableOpacity
            key={preset.id}
            onPress={() => setSelectedPreset(preset)}
            activeOpacity={0.85}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={[styles.cardStripe, { backgroundColor: preset.accent }]} />
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text style={styles.cardEmoji}>{preset.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardName, { color: colors.text }]}>{preset.name}</Text>
                  <Text style={[styles.cardTag,  { color: colors.text3 }]}>{preset.tagline}</Text>
                </View>
              </View>
              <View style={styles.cardMetaRow}>
                <MetaPill label={`${preset.durationWeeks}w`} colors={colors} />
                <MetaPill label={`${preset.daysPerWeek}/wk`} colors={colors} />
                <View style={[styles.levelPill, { backgroundColor: (LEVEL_COLOR[preset.level] || '#888') + '22', borderColor: LEVEL_COLOR[preset.level] || '#888' }]}>
                  <Text style={[styles.levelPillText, { color: LEVEL_COLOR[preset.level] || '#888' }]}>{preset.level}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Preview / confirm modal */}
      <Modal
        visible={!!selectedPreset}
        animationType="slide"
        transparent
        onRequestClose={() => !confirming && setSelectedPreset(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32, maxHeight: '80%' }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 }} />
            {selectedPreset && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 38, marginRight: 12 }}>{selectedPreset.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedPreset.name}</Text>
                    <Text style={[styles.modalTagline, { color: colors.text3 }]}>{selectedPreset.tagline}</Text>
                  </View>
                </View>

                <View style={styles.modalMetaRow}>
                  <MetaPill label={`${selectedPreset.durationWeeks} weeks`} colors={colors} />
                  <MetaPill label={`${selectedPreset.daysPerWeek} days/wk`} colors={colors} />
                  <View style={[styles.levelPill, { backgroundColor: (LEVEL_COLOR[selectedPreset.level] || '#888') + '22', borderColor: LEVEL_COLOR[selectedPreset.level] || '#888' }]}>
                    <Text style={[styles.levelPillText, { color: LEVEL_COLOR[selectedPreset.level] || '#888' }]}>{selectedPreset.level}</Text>
                  </View>
                </View>

                <ScrollView style={{ maxHeight: 200 }}>
                  <Text style={[styles.modalDesc, { color: colors.text2 }]}>{selectedPreset.description}</Text>
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                  <TouchableOpacity
                    onPress={() => setSelectedPreset(null)}
                    style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}
                    disabled={confirming}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={confirmReplace}
                    style={[styles.modalBtn, { backgroundColor: selectedPreset.accent }]}
                    disabled={confirming}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>Start plan</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MetaPill({ label, colors }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginRight: 8 }}>
      <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  backBtn: { padding: 6, width: 50 },
  backBtnText: { fontSize: 15, fontWeight: '600' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },

  intro: { fontSize: 14, marginBottom: 16, paddingHorizontal: 6 },

  card: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  cardStripe: { width: 6 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardEmoji: { fontSize: 32, marginRight: 12 },
  cardName: { fontSize: 17, fontWeight: '800' },
  cardTag: { fontSize: 13, marginTop: 2 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },

  levelPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  levelPillText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },

  modalTitle:   { fontSize: 22, fontWeight: '900' },
  modalTagline: { fontSize: 13, marginTop: 2 },
  modalMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' },
  modalDesc:    { fontSize: 14, lineHeight: 21 },
  modalBtn:     { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { fontWeight: '800', fontSize: 15 },
});
