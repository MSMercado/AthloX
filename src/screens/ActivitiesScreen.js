// v2.0 — Activities tab. Replaces the role of the old Progress tab and is
// the destination after finishing any GPS / strength / circuit workout.
//
// Two sub-tabs: Workouts (history list) + Performance (charts + PRs + stats).
// Each sub-tab lives in its own component file under ./activities/ to keep
// this scaffold scannable as the surface grows.
//
// Bottom-tab placement: added alongside the existing Workout + Plan tabs as
// an interim 6-tab layout. Will collapse to 5 tabs once the merged
// Plan+Workout tab lands later in v2.0.

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import useColors from '../lib/useColors';
import HeaderActions from '../components/HeaderActions';
import WorkoutsTab    from './activities/WorkoutsTab';
import PerformanceTab from './activities/PerformanceTab';

// v2.0 — ad-hoc workout types reachable from the Activities '+' button.
// GPS types push TrackScreen with the right `startRun` param so the GPS
// flow auto-starts. Strength pushes TrackScreen and lands on home so the
// user can pick a routine or build one.
const ADHOC_TYPES = [
  { id: 'run',      label: 'Run',      emoji: '🏃', startRun: 'run'  },
  { id: 'bike',     label: 'Bike',     emoji: '🚴', startRun: 'bike' },
  { id: 'walk',     label: 'Walk',     emoji: '🚶', startRun: 'walk' },
  { id: 'hike',     label: 'Hike',     emoji: '🥾', startRun: 'hike' },
  { id: 'strength', label: 'Strength', emoji: '🏋️', startRun: null   },
];

const SUB_TABS = [
  { id: 'workouts',    label: 'Workouts'    },
  { id: 'performance', label: 'Performance' },
];

export default function ActivitiesScreen() {
  const colors = useColors();
  const navigation = useNavigation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [active, setActive] = useState('workouts');
  const [adhocOpen, setAdhocOpen] = useState(false);

  const startAdhoc = (type) => {
    setAdhocOpen(false);
    if (type.startRun) {
      // GPS activity — push Workout with auto-start params (timestamp so
      // re-tapping always re-triggers the autostart effect).
      navigation.navigate('Workout', { startRun: type.startRun, startRunAt: Date.now() });
    } else {
      // Strength — just land on the Workout home so the user can pick a
      // routine or use the builder.
      navigation.navigate('Workout');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <HeaderActions />
        <Text style={[styles.title, { color: colors.text }]}>Activities</Text>
        <TouchableOpacity onPress={() => setAdhocOpen(true)} style={{ width: 60, alignItems: 'flex-end', paddingRight: 8 }} activeOpacity={0.7}>
          <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 26 }}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Ad-hoc workout picker */}
      <Modal visible={adhocOpen} animationType="fade" transparent onRequestClose={() => setAdhocOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setAdhocOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 22, borderTopRightRadius: 22,
            paddingTop: 12, paddingBottom: 28, paddingHorizontal: 6,
          }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 }} />
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>Start workout</Text>
            <Text style={{ color: colors.text3, fontSize: 13, textAlign: 'center', marginBottom: 16 }}>Pick an activity to start now</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {ADHOC_TYPES.map(t => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => startAdhoc(t)}
                  activeOpacity={0.7}
                  style={{
                    paddingVertical: 18, paddingHorizontal: 22,
                    borderBottomWidth: 1, borderBottomColor: colors.border,
                    flexDirection: 'row', alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 28, marginRight: 16 }}>{t.emoji}</Text>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Sub-tab switcher */}
      <View style={[styles.subTabs, { borderBottomColor: colors.border }]}>
        {SUB_TABS.map(tab => {
          const isActive = active === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.subTabBtn, isActive && { borderBottomColor: colors.accent }]}
              onPress={() => setActive(tab.id)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.subTabLabel,
                { color: isActive ? colors.text : colors.text3 },
                isActive && { fontWeight: '800' },
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Active sub-tab body */}
      <View style={{ flex: 1 }}>
        {active === 'workouts'    && <WorkoutsTab />}
        {active === 'performance' && <PerformanceTab />}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title:       { fontSize: 17, fontWeight: '800' },

  subTabs:     { flexDirection: 'row', borderBottomWidth: 1 },
  subTabBtn:   { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  subTabLabel: { fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});
