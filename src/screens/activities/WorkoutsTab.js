// v2.0 — Workouts sub-tab.
// Merges local strength/circuit logs (from useStore) with GPS-tracked runs
// (from run_activities Supabase table), groups by month, and renders the
// Runna-style activity card list.
//
// Filter UX: horizontal scrollable chips (simpler than Runna's three
// dropdowns, matches AthloX's chip style elsewhere).
//
// Tap behavior:
//   - GPS activity with a run_activities row → push RunSummary
//   - everything else → quick details Alert (will become a proper detail
//     screen in a later version once strength workouts persist their full
//     exercise log to Supabase)

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import useColors from '../../lib/useColors';
import useStore from '../../store/useStore';
import { listRunActivities } from '../../lib/runActivities';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── Type → visual mapping ────────────────────────────────────────────────────
// Each entry: { stripe color, emoji shown in the card icon circle, label
// used in the type filter chip }.
const TYPE_META = {
  run:      { stripe: '#10b981',  emoji: '🏃', label: 'Run'      },
  bike:     { stripe: '#3b82f6',  emoji: '🚴', label: 'Bike'     },
  walk:     { stripe: '#22c55e',  emoji: '🚶', label: 'Walk'     },
  hike:     { stripe: '#8b5cf6',  emoji: '🥾', label: 'Hike'     },
  strength: { stripe: '#3b82f6',  emoji: '🏋️', label: 'Strength' },
  circuit:  { stripe: '#a855f7',  emoji: '⚡', label: 'Circuit'  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function fmtPace(minPerKm) {
  if (minPerKm == null || !isFinite(minPerKm)) return null;
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

function fmtMonthHeader(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function fmtCardDate(date) {
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Coerce a log entry's `type` field into one of our normalized types.
function normalizeType(log) {
  const t = (log.type || '').toLowerCase();
  if (t === 'cardio') {
    // legacy: cardio could be run/walk/bike/hike — infer from the routine name
    const r = (log.routine || '').toLowerCase();
    if (r.includes('bike') || r.includes('cycle')) return 'bike';
    if (r.includes('walk'))                         return 'walk';
    if (r.includes('hike'))                         return 'hike';
    return 'run';
  }
  // Strength + circuit are both stored as 'strength' today (see CircuitTimerScreen).
  // We can't distinguish them from the log alone — circuits will appear as
  // strength for now. A future schema bump will add a `subtype` field.
  if (t === 'strength') return 'strength';
  if (t === 'circuit')  return 'circuit';
  return 'strength';
}

// Merge local logs + GPS run_activities into a single unified array.
function mergeFeed(logs, runs) {
  // Index runs by log timestamp proximity so we can stitch the Supabase row
  // id onto its matching local log entry (used so tapping opens RunSummary).
  const runsByMatch = new Map();
  for (const r of runs) {
    runsByMatch.set(new Date(r.startedAt).getTime(), r);
  }

  const out = [];
  for (const log of logs) {
    const ts = log.ts || (log.id && Number(log.id)) || Date.parse(log.date || '');
    if (!ts) continue;
    const normType = normalizeType(log);
    // Find a matching run within a 60-second window (tracking finish + save
    // can race by a few seconds).
    let runMatch = null;
    for (const [runTs, run] of runsByMatch) {
      if (Math.abs(runTs - ts) < 60000 && (normType === 'run' || normType === 'bike' || normType === 'walk' || normType === 'hike')) {
        runMatch = run;
        break;
      }
    }
    out.push({
      id:           `log-${log.id || ts}`,
      ts,
      date:         new Date(ts),
      type:         normType,
      title:        log.routine || (TYPE_META[normType]?.label || 'Workout'),
      durationSec:  (log.duration || 0) * 60,
      distanceKm:   log.distance != null ? Number(log.distance) : (runMatch?.distanceKm ?? null),
      paceMinPerKm: runMatch?.avgPaceMinPerKm ?? null,
      calories:     log.calories ?? runMatch?.calories ?? null,
      runActivityId:      log.runActivityId      || runMatch?.id || null,
      // v2.0 — strength sessions persist per-exercise detail too.
      strengthSessionId:  log.strengthSessionId  || null,
      raw:          log,
    });
  }

  // Add any GPS runs that didn't pair to a local log (rare — happens if local
  // log was cleared but the Supabase row survived).
  const matchedRunIds = new Set(out.map(o => o.runActivityId).filter(Boolean));
  for (const r of runs) {
    if (matchedRunIds.has(r.id)) continue;
    const ts = new Date(r.startedAt).getTime();
    out.push({
      id:           `run-${r.id}`,
      ts,
      date:         new Date(ts),
      type:         (r.activityType || 'run').toLowerCase(),
      title:        TYPE_META[(r.activityType || 'run').toLowerCase()]?.label || 'Run',
      durationSec:  r.durationSec || 0,
      distanceKm:   r.distanceKm,
      paceMinPerKm: r.avgPaceMinPerKm,
      calories:     r.calories,
      runActivityId: r.id,
      raw:          r,
    });
  }

  // Newest first.
  out.sort((a, b) => b.ts - a.ts);
  return out;
}

// Group a sorted feed by month and pre-compute the per-month summary.
function groupByMonth(feed) {
  const groups = [];
  let current = null;
  for (const item of feed) {
    const key = `${item.date.getFullYear()}-${item.date.getMonth()}`;
    if (!current || current.key !== key) {
      current = { key, monthDate: item.date, items: [], totalDistKm: 0, totalDurSec: 0 };
      groups.push(current);
    }
    current.items.push(item);
    current.totalDurSec += item.durationSec || 0;
    if (item.distanceKm) current.totalDistKm += item.distanceKm;
  }
  return groups;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function WorkoutsTab() {
  const colors = useColors();
  const navigation = useNavigation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { logs, user } = useStore();

  const [runs, setRuns]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefresh] = useState(false);
  // v2.0 filters: month + year (null = all). Replaces the workout-type chips
  // to match Runna's Activities tab and reduce duplication with the per-month
  // section headers (filtering by type was a tab-bar-like concept; filtering
  // by date is the natural "find a specific workout" gesture).
  const [filterYear,  setFilterYear]  = useState(null); // number | null
  const [filterMonth, setFilterMonth] = useState(null); // 0-11 | null
  const [openPicker,  setOpenPicker]  = useState(null); // 'year' | 'month' | null

  const loadRuns = useCallback(async () => {
    if (!user?.id) { setRuns([]); setLoading(false); return; }
    try {
      const list = await listRunActivities({ limit: 200 });
      setRuns(list || []);
    } catch {
      // Stay with whatever we had — local logs still render.
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, [user?.id]);

  useEffect(() => { loadRuns(); }, [loadRuns]);
  useFocusEffect(useCallback(() => { loadRuns(); }, [loadRuns]));

  // Combined + filtered + grouped.
  const feed = useMemo(() => mergeFeed(logs || [], runs), [logs, runs]);

  // Years that have any activity — drives the Year picker options.
  const availableYears = useMemo(() => {
    const set = new Set(feed.map(i => i.date.getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [feed]);

  // Months that have activity in the currently-selected year (or all years).
  const availableMonths = useMemo(() => {
    const inYear = filterYear == null ? feed : feed.filter(i => i.date.getFullYear() === filterYear);
    const set = new Set(inYear.map(i => i.date.getMonth()));
    return Array.from(set).sort((a, b) => b - a);
  }, [feed, filterYear]);

  const groups = useMemo(() => {
    const filtered = feed.filter(i => {
      if (filterYear  != null && i.date.getFullYear() !== filterYear)  return false;
      if (filterMonth != null && i.date.getMonth()    !== filterMonth) return false;
      return true;
    });
    return groupByMonth(filtered);
  }, [feed, filterYear, filterMonth]);

  const onCardPress = (item) => {
    if (item.runActivityId) {
      navigation.navigate('RunSummary', { activityId: item.runActivityId });
      return;
    }
    // v2.0 — strength sessions with persisted detail go to StrengthDetail.
    if (item.strengthSessionId) {
      navigation.navigate('StrengthDetail', { sessionId: item.strengthSessionId });
      return;
    }
    // Pre-v2.0 strength logs (no session id) fall back to the quick Alert.
    const lines = [];
    if (item.durationSec) lines.push(`Time: ${fmtTime(item.durationSec)}`);
    if (item.distanceKm)  lines.push(`Distance: ${item.distanceKm.toFixed(2)} km`);
    if (item.calories)    lines.push(`Calories: ${item.calories}`);
    Alert.alert(item.title, lines.join('\n') || 'No additional details saved.');
  };

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefresh(true); loadRuns(); }}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      {/* Month + Year filters */}
      <View style={styles.filterRow}>
        <FilterPill
          label={filterYear  == null ? 'All years'     : String(filterYear)}
          onPress={() => setOpenPicker('year')}
          colors={colors}
        />
        <FilterPill
          label={filterMonth == null ? 'All months'    : MONTH_NAMES[filterMonth]}
          onPress={() => setOpenPicker('month')}
          colors={colors}
        />
        {(filterYear != null || filterMonth != null) && (
          <TouchableOpacity
            onPress={() => { setFilterYear(null); setFilterMonth(null); }}
            style={styles.clearBtn}
            activeOpacity={0.7}
          >
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Year / Month picker modal */}
      <PickerModal
        visible={openPicker === 'year'}
        title="Year"
        options={[{ value: null, label: 'All years' }, ...availableYears.map(y => ({ value: y, label: String(y) }))]}
        selected={filterYear}
        onSelect={(v) => { setFilterYear(v); setOpenPicker(null); }}
        onClose={() => setOpenPicker(null)}
        colors={colors}
      />
      <PickerModal
        visible={openPicker === 'month'}
        title="Month"
        options={[{ value: null, label: 'All months' }, ...availableMonths.map(m => ({ value: m, label: MONTH_NAMES[m] }))]}
        selected={filterMonth}
        onSelect={(v) => { setFilterMonth(v); setOpenPicker(null); }}
        onClose={() => setOpenPicker(null)}
        colors={colors}
      />

      {groups.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No activities yet</Text>
          <Text style={[styles.emptySub,   { color: colors.text3 }]}>
            Your workouts and runs will show up here.
          </Text>
        </View>
      ) : (
        groups.map(group => (
          <View key={group.key} style={{ marginTop: 18 }}>
            <View style={styles.monthHeader}>
              <Text style={[styles.monthTitle, { color: colors.text }]}>{fmtMonthHeader(group.monthDate)}</Text>
              {group.totalDistKm > 0 && (
                <Text style={[styles.monthDist, { color: colors.text3 }]}>{group.totalDistKm.toFixed(1)} km</Text>
              )}
            </View>
            <Text style={[styles.monthSummary, { color: colors.text3 }]}>
              {group.items.length} {group.items.length === 1 ? 'activity' : 'activities'} · {fmtTime(group.totalDurSec)}
            </Text>

            {group.items.map(item => {
              const meta = TYPE_META[item.type] || TYPE_META.strength;
              const isRunLike = ['run','bike','walk','hike'].includes(item.type);
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.85}
                  onPress={() => onCardPress(item)}
                  style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={[styles.cardStripe, { backgroundColor: meta.stripe || colors.text3 }]} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardIcon}>{meta.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={[styles.cardDate, { color: colors.text3 }]}>{fmtCardDate(item.date)}</Text>
                      </View>
                    </View>

                    <View style={styles.cardStats}>
                      {isRunLike && item.distanceKm != null && (
                        <Stat label="Distance" value={`${item.distanceKm.toFixed(2)} km`} colors={colors} />
                      )}
                      <Stat label="Time" value={fmtTime(item.durationSec)} colors={colors} />
                      {isRunLike && item.paceMinPerKm != null && (
                        <Stat label="Avg pace" value={fmtPace(item.paceMinPerKm)} colors={colors} />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Stat({ label, value, colors }) {
  return (
    <View style={{ marginRight: 22 }}>
      <Text style={{ color: colors.text3, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function FilterPill({ label, onPress, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 18, borderWidth: 1,
        borderColor: colors.border, backgroundColor: colors.surface,
        marginRight: 8,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
      <Text style={{ color: colors.text3, fontSize: 10 }}>▼</Text>
    </TouchableOpacity>
  );
}

function PickerModal({ visible, title, options, selected, onSelect, onClose, colors }) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          paddingTop: 12, paddingBottom: 28,
          maxHeight: '70%',
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 }} />
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>{title}</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {options.map((opt, i) => {
              const isSel = opt.value === selected;
              return (
                <TouchableOpacity
                  key={String(opt.value) + '-' + i}
                  onPress={() => onSelect(opt.value)}
                  activeOpacity={0.7}
                  style={{
                    paddingVertical: 16, paddingHorizontal: 22,
                    borderBottomWidth: 1, borderBottomColor: colors.border,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <Text style={{ color: isSel ? colors.accent : colors.text, fontSize: 16, fontWeight: isSel ? '800' : '600' }}>
                    {opt.label}
                  </Text>
                  {isSel && <Text style={{ color: colors.accent, fontSize: 18 }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  filterRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  clearBtn:    { paddingHorizontal: 8, paddingVertical: 6 },

  emptyWrap:   { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  emptyTitle:  { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  emptySub:    { fontSize: 14, textAlign: 'center' },

  monthHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 4 },
  monthTitle:  { fontSize: 22, fontWeight: '800' },
  monthDist:   { fontSize: 15, fontWeight: '700' },
  monthSummary:{ fontSize: 13, paddingHorizontal: 16, marginBottom: 10 },

  card:        { flexDirection: 'row', borderRadius: 16, borderWidth: 1, marginHorizontal: 14, marginBottom: 10, overflow: 'hidden' },
  cardStripe:  { width: 6 },
  cardBody:    { flex: 1, padding: 14 },
  cardTopRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardIcon:    { fontSize: 28, marginRight: 12 },
  cardTitle:   { fontSize: 17, fontWeight: '800' },
  cardDate:    { fontSize: 12, marginTop: 2 },
  cardStats:   { flexDirection: 'row', flexWrap: 'wrap' },
});
