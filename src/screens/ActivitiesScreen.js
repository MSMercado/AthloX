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
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useColors from '../lib/useColors';
import HeaderActions from '../components/HeaderActions';
import WorkoutsTab    from './activities/WorkoutsTab';
import PerformanceTab from './activities/PerformanceTab';

const SUB_TABS = [
  { id: 'workouts',    label: 'Workouts'    },
  { id: 'performance', label: 'Performance' },
];

export default function ActivitiesScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [active, setActive] = useState('workouts');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <HeaderActions />
        <Text style={[styles.title, { color: colors.text }]}>Activities</Text>
        <View style={{ width: 60 }} />
      </View>

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
