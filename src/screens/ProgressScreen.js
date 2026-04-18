import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import useStore from '../store/useStore';
import useColors from '../lib/useColors';
import { shadow } from '../lib/theme';

const { width } = Dimensions.get('window');
const CHART_W = width - 64;

// ── Data helpers ──────────────────────────────────────────────────────────────

function startOfDay(ts) {
  const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime();
}

function computeStreak(logs) {
  if (!logs.length) return 0;
  const sorted = [...logs].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const today  = startOfDay(Date.now());
  const DAY    = 86400000;
  let streak = 0, cursor = today;
  const daysSet = new Set(sorted.map(l => startOfDay(l.ts || Date.now())));
  while (daysSet.has(cursor) || (streak === 0 && daysSet.has(cursor - DAY))) {
    if (daysSet.has(cursor)) { streak++; cursor -= DAY; }
    else if (streak === 0)   { cursor -= DAY; }
    else break;
  }
  return streak;
}

function getLongestStreak(logs) {
  if (!logs.length) return 0;
  const DAY  = 86400000;
  const days = [...new Set(logs.map(l => startOfDay(l.ts || Date.now())))].sort((a, b) => a - b);
  let max = 1, cur = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i] - days[i - 1] === DAY) { cur++; max = Math.max(max, cur); }
    else cur = 1;
  }
  return max;
}

function getLast7Days(logs) {
  const DAY = 86400000;
  const now = Date.now();
  const LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return Array.from({ length: 7 }, (_, i) => {
    const dayStart = startOfDay(now - (6 - i) * DAY);
    const dayEnd   = dayStart + DAY - 1;
    const dayLogs  = logs.filter(l => (l.ts || 0) >= dayStart && (l.ts || 0) <= dayEnd);
    const d = new Date(dayStart);
    return {
      label:    i === 6 ? 'Today' : LABELS[d.getDay()],
      calories: dayLogs.reduce((s, l) => s + (l.calories || 0), 0),
      duration: dayLogs.reduce((s, l) => s + (l.duration || 0), 0),
      count:    dayLogs.length,
      isToday:  i === 6,
    };
  });
}

function getLast8Weeks(logs) {
  const DAY  = 86400000;
  const WEEK = DAY * 7;
  const now  = Date.now();
  return Array.from({ length: 8 }, (_, i) => {
    const weekEnd   = now - (7 - i - 1) * WEEK;
    const weekStart = weekEnd - WEEK;
    const wLogs = logs.filter(l => (l.ts || 0) >= weekStart && (l.ts || 0) < weekEnd);
    const label = i === 7 ? 'This\nweek' : `${8 - i}w\nago`;
    return {
      label,
      count:    wLogs.length,
      calories: wLogs.reduce((s, l) => s + (l.calories || 0), 0),
      duration: wLogs.reduce((s, l) => s + (l.duration || 0), 0),
      isCurrent: i === 7,
    };
  });
}

// 91 days heatmap (13 weeks × 7 days)
function getHeatmap(logs) {
  const DAY = 86400000;
  const now = startOfDay(Date.now());
  const set = {};
  logs.forEach(l => {
    const key = startOfDay(l.ts || Date.now());
    set[key] = (set[key] || 0) + 1;
  });
  return Array.from({ length: 91 }, (_, i) => {
    const ts  = now - (90 - i) * DAY;
    const cnt = set[ts] || 0;
    return { ts, count: cnt };
  });
}

function getMuscleBreakdown(logs) {
  const map = {};
  logs.forEach(l => {
    if (l.exercises?.length) {
      l.exercises.forEach(ex => {
        const m = ex.muscle || 'Other';
        map[m] = (map[m] || 0) + 1;
      });
    } else {
      const key = l.type === 'cardio' ? 'Cardio' : 'Full Body';
      map[key] = (map[key] || 0) + 1;
    }
  });
  const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }));
}

const PERIOD_TABS = ['7 Days', '8 Weeks', 'All Time'];

const MUSCLE_COLORS = ['#ff4d00','#10b981','#3b82f6','#8b5cf6','#f59e0b'];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, sub, colors, accent }) {
  return (
    <View style={[sc.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={sc.icon}>{icon}</Text>
      <Text style={[sc.value, { color: accent || colors.text }]}>{value}</Text>
      <Text style={[sc.label, { color: colors.text2 }]}>{label}</Text>
      {sub ? <Text style={[sc.sub, { color: colors.text3 }]}>{sub}</Text> : null}
    </View>
  );
}
const sc = StyleSheet.create({
  card:  { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, ...shadow.card },
  icon:  { fontSize: 22, marginBottom: 6 },
  value: { fontSize: 22, fontWeight: '900', lineHeight: 24 },
  label: { fontSize: 11, marginTop: 3, textAlign: 'center' },
  sub:   { fontSize: 10, marginTop: 2 },
});

// Generic bar chart — accepts array of { label, value, isHighlight }
function BarChart({ data, color, height = 100, showValues = false, colors }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={bc.wrap}>
      <View style={[bc.chart, { height }]}>
        {data.map((d, i) => (
          <View key={i} style={bc.col}>
            {showValues && d.value > 0 && (
              <Text style={[bc.topVal, { color: d.isHighlight ? color : colors.text3 }]}>
                {d.value > 999 ? `${(d.value/1000).toFixed(1)}k` : d.value}
              </Text>
            )}
            <View style={bc.barWrap}>
              <View style={[bc.bar, {
                height: Math.max((d.value / maxVal) * (height - (showValues ? 20 : 8)), 3),
                backgroundColor: d.value === 0 ? colors.border : (d.isHighlight ? color : color + '60'),
                borderRadius: 4,
              }]} />
            </View>
          </View>
        ))}
      </View>
      <View style={bc.labels}>
        {data.map((d, i) => (
          <Text key={i} style={[bc.label, { color: d.isHighlight ? color : colors.text3 },
            d.isHighlight && { fontWeight: '700' }]}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
const bc = StyleSheet.create({
  wrap:    { width: '100%' },
  chart:   { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  col:     { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  topVal:  { fontSize: 9, marginBottom: 2 },
  barWrap: { width: '100%', justifyContent: 'flex-end' },
  bar:     { width: '100%' },
  labels:  { flexDirection: 'row', marginTop: 6, gap: 4 },
  label:   { flex: 1, textAlign: 'center', fontSize: 9 },
});

// Activity heatmap (13 cols × 7 rows)
function Heatmap({ data, accent, colors }) {
  const weeks = [];
  for (let w = 0; w < 13; w++) weeks.push(data.slice(w * 7, w * 7 + 7));
  const DAYS = ['M','T','W','T','F','S','S'];

  return (
    <View style={hm.wrap}>
      <View style={hm.dayLabels}>
        {DAYS.map((d, i) => (
          <Text key={i} style={[hm.dayLabel, { color: colors.text3 }]}>{d}</Text>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={hm.grid}>
          {weeks.map((week, wi) => (
            <View key={wi} style={hm.weekCol}>
              {week.map((day, di) => (
                <View key={di} style={[hm.cell, {
                  backgroundColor: day.count === 0 ? colors.border :
                    day.count === 1 ? accent + '55' :
                    day.count === 2 ? accent + '99' : accent,
                }]} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
const CELL = 13;
const hm = StyleSheet.create({
  wrap:      { flexDirection: 'row', gap: 4 },
  dayLabels: { gap: 3, paddingTop: 0 },
  dayLabel:  { width: 12, height: CELL, fontSize: 8, textAlign: 'center', lineHeight: CELL },
  grid:      { flexDirection: 'row', gap: 3 },
  weekCol:   { gap: 3 },
  cell:      { width: CELL, height: CELL, borderRadius: 3 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const navigation = useNavigation();
  const { logs }   = useStore();
  const colors     = useColors();
  const styles     = useMemo(() => makeStyles(colors), [colors]);

  const [period, setPeriod] = useState('7 Days');

  // ── Computed data ──
  const allTime = useMemo(() => ({
    workouts:  logs.length,
    calories:  logs.reduce((s, l) => s + (l.calories || 0), 0),
    minutes:   logs.reduce((s, l) => s + (l.duration || 0), 0),
    distance:  logs.reduce((s, l) => s + (l.distance || 0), 0),
  }), [logs]);

  const streak        = useMemo(() => computeStreak(logs), [logs]);
  const longestStreak = useMemo(() => getLongestStreak(logs), [logs]);
  const last7         = useMemo(() => getLast7Days(logs), [logs]);
  const last8w        = useMemo(() => getLast8Weeks(logs), [logs]);
  const heatmap       = useMemo(() => getHeatmap(logs), [logs]);
  const muscles       = useMemo(() => getMuscleBreakdown(logs), [logs]);

  const strengthCount = logs.filter(l => l.type !== 'cardio' && l.type !== 'gps').length;
  const cardioCount   = logs.filter(l => l.type === 'cardio' || l.type === 'gps').length;
  const splitTotal    = strengthCount + cardioCount || 1;

  // Chart data for selected period
  const barData7 = last7.map(d => ({
    label:       d.label === 'Today' ? 'Today' : d.label,
    value:       period === '7 Days' ? d.calories : d.count,
    isHighlight: d.isToday,
  }));

  const barData8w = last8w.map(d => ({
    label:       d.label,
    value:       period === '8 Weeks' ? d.count : d.calories,
    isHighlight: d.isCurrent,
  }));

  const personalBests = [
    { icon: '🔥', label: 'Current streak',   value: `${streak} day${streak !== 1 ? 's' : ''}` },
    { icon: '🏆', label: 'Longest streak',   value: `${longestStreak} day${longestStreak !== 1 ? 's' : ''}` },
    { icon: '💪', label: 'Total workouts',   value: allTime.workouts.toString() },
    { icon: '⏱️', label: 'Total hours',      value: `${Math.floor(allTime.minutes / 60)}h ${allTime.minutes % 60}m` },
    { icon: '🔥', label: 'Total calories',   value: allTime.calories.toLocaleString() },
    { icon: '📏', label: 'Total distance',   value: `${allTime.distance.toFixed(1)} km` },
  ];

  const isEmpty = logs.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.pageTitle}>Progress</Text>
            <Text style={styles.pageSub}>{allTime.workouts} total workouts</Text>
          </View>
        </View>

        {isEmpty ? (
          <View style={styles.emptyWrap}>
            <Text style={{ fontSize: 52, marginBottom: 16 }}>📊</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No data yet</Text>
            <Text style={[styles.emptySub, { color: colors.text2 }]}>
              Complete your first workout to start seeing your progress charts and stats here.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Overview Stats (2×2 grid) ── */}
            <View style={styles.statsGrid}>
              <View style={styles.statsRow}>
                <StatCard icon="💪" value={allTime.workouts} label="Workouts" colors={colors} accent={colors.accent} />
                <StatCard icon="🔥" value={allTime.calories.toLocaleString()} label="Total Cal" colors={colors} accent={colors.accent} />
              </View>
              <View style={styles.statsRow}>
                <StatCard icon="⏱️" value={`${Math.floor(allTime.minutes / 60)}h`} label="Total Time" sub={`${allTime.minutes % 60}m extra`} colors={colors} />
                <StatCard icon="🏅" value={`${streak}d`} label="Streak" sub={`Best: ${longestStreak}d`} colors={colors} accent={colors.green} />
              </View>
            </View>

            {/* ── Period selector ── */}
            <View style={[styles.periodRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {PERIOD_TABS.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodBtn, period === p && { backgroundColor: colors.accent }]}
                  onPress={() => setPeriod(p)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.periodBtnText, { color: period === p ? '#fff' : colors.text2 }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── 7-Day Charts ── */}
            {period === '7 Days' && (
              <>
                <View style={[styles.card, { marginBottom: 14 }]}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Calories Burned — Last 7 Days</Text>
                  <Text style={[styles.cardSub, { color: colors.text3 }]}>Daily totals</Text>
                  <BarChart
                    data={barData7}
                    color={colors.accent}
                    height={110}
                    showValues
                    colors={colors}
                  />
                </View>

                <View style={[styles.card, { marginBottom: 14 }]}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Workout Sessions — Last 7 Days</Text>
                  <BarChart
                    data={last7.map(d => ({ label: d.label, value: d.count, isHighlight: d.isToday }))}
                    color={colors.blue}
                    height={90}
                    colors={colors}
                  />
                </View>
              </>
            )}

            {/* ── 8-Week Charts ── */}
            {period === '8 Weeks' && (
              <>
                <View style={[styles.card, { marginBottom: 14 }]}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Sessions per Week</Text>
                  <Text style={[styles.cardSub, { color: colors.text3 }]}>Last 8 weeks</Text>
                  <BarChart
                    data={last8w.map(d => ({ label: d.label, value: d.count, isHighlight: d.isCurrent }))}
                    color={colors.accent}
                    height={110}
                    showValues
                    colors={colors}
                  />
                </View>

                <View style={[styles.card, { marginBottom: 14 }]}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Calories per Week</Text>
                  <BarChart
                    data={last8w.map(d => ({ label: d.label, value: d.calories, isHighlight: d.isCurrent }))}
                    color={colors.green}
                    height={110}
                    showValues
                    colors={colors}
                  />
                </View>

                <View style={[styles.card, { marginBottom: 14 }]}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Minutes Trained per Week</Text>
                  <BarChart
                    data={last8w.map(d => ({ label: d.label, value: d.duration, isHighlight: d.isCurrent }))}
                    color={colors.blue}
                    height={90}
                    showValues
                    colors={colors}
                  />
                </View>
              </>
            )}

            {/* ── All Time ── */}
            {period === 'All Time' && (
              <>
                {/* Personal Bests */}
                <View style={[styles.card, { marginBottom: 14 }]}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Personal Stats</Text>
                  {personalBests.map((pb, i) => (
                    <View key={i} style={[styles.pbRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                      <Text style={styles.pbIcon}>{pb.icon}</Text>
                      <Text style={[styles.pbLabel, { color: colors.text2 }]}>{pb.label}</Text>
                      <Text style={[styles.pbValue, { color: colors.text }]}>{pb.value}</Text>
                    </View>
                  ))}
                </View>

                {/* Workout type split */}
                <View style={[styles.card, { marginBottom: 14 }]}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Workout Type Split</Text>
                  <View style={styles.splitRow}>
                    <View style={styles.splitBar}>
                      <View style={[styles.splitFill, {
                        width: `${(strengthCount / splitTotal) * 100}%`,
                        backgroundColor: colors.accent,
                        borderTopLeftRadius: 6, borderBottomLeftRadius: 6,
                        borderTopRightRadius: cardioCount === 0 ? 6 : 0,
                        borderBottomRightRadius: cardioCount === 0 ? 6 : 0,
                      }]} />
                      <View style={[styles.splitFill, {
                        width: `${(cardioCount / splitTotal) * 100}%`,
                        backgroundColor: colors.green,
                        borderTopRightRadius: 6, borderBottomRightRadius: 6,
                        borderTopLeftRadius: strengthCount === 0 ? 6 : 0,
                        borderBottomLeftRadius: strengthCount === 0 ? 6 : 0,
                      }]} />
                    </View>
                  </View>
                  <View style={styles.splitLegend}>
                    <View style={styles.splitLegendItem}>
                      <View style={[styles.splitDot, { backgroundColor: colors.accent }]} />
                      <Text style={[styles.splitLegendText, { color: colors.text2 }]}>
                        Strength — {strengthCount} ({Math.round((strengthCount / splitTotal) * 100)}%)
                      </Text>
                    </View>
                    <View style={styles.splitLegendItem}>
                      <View style={[styles.splitDot, { backgroundColor: colors.green }]} />
                      <Text style={[styles.splitLegendText, { color: colors.text2 }]}>
                        Cardio — {cardioCount} ({Math.round((cardioCount / splitTotal) * 100)}%)
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Muscle breakdown */}
                {muscles.length > 0 && (
                  <View style={[styles.card, { marginBottom: 14 }]}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Top Muscle Groups</Text>
                    {muscles.map((m, i) => (
                      <View key={i} style={styles.muscleRow}>
                        <View style={styles.muscleLabelRow}>
                          <View style={[styles.muscleDot, { backgroundColor: MUSCLE_COLORS[i] }]} />
                          <Text style={[styles.muscleName, { color: colors.text2 }]}>{m.name}</Text>
                          <Text style={[styles.musclePct, { color: colors.text3 }]}>{m.pct}%</Text>
                        </View>
                        <View style={[styles.muscleBarBg, { backgroundColor: colors.border }]}>
                          <View style={[styles.muscleBarFill, { width: `${m.pct}%`, backgroundColor: MUSCLE_COLORS[i] }]} />
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* ── Activity Heatmap (always visible) ── */}
            <View style={[styles.card, { marginBottom: 14 }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Activity — Last 13 Weeks</Text>
              <Text style={[styles.cardSub, { color: colors.text3 }]}>Each square = one day</Text>
              <View style={{ marginTop: 12 }}>
                <Heatmap data={heatmap} accent={colors.accent} colors={colors} />
              </View>
              <View style={styles.heatLegend}>
                <Text style={[styles.heatLegendLabel, { color: colors.text3 }]}>Less</Text>
                {['border','accent55','accent99','accent'].map((k, i) => (
                  <View key={i} style={[styles.heatCell, {
                    backgroundColor: i === 0 ? colors.border : i === 1 ? colors.accent + '55' : i === 2 ? colors.accent + '99' : colors.accent,
                  }]} />
                ))}
                <Text style={[styles.heatLegendLabel, { color: colors.text3 }]}>More</Text>
              </View>
            </View>

          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  scroll:       { paddingHorizontal: 16, paddingBottom: 40 },

  header:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, paddingBottom: 18 },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon:     { fontSize: 34, color: colors.text, lineHeight: 36, marginTop: -2 },
  pageTitle:    { fontSize: 32, fontWeight: '900', color: colors.text },
  pageSub:      { fontSize: 13, color: colors.text2, marginTop: 1 },

  statsGrid:    { gap: 10, marginBottom: 16 },
  statsRow:     { flexDirection: 'row', gap: 10 },

  periodRow:    { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, gap: 4, marginBottom: 16 },
  periodBtn:    { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  periodBtnText:{ fontSize: 13, fontWeight: '600' },

  card:         { backgroundColor: colors.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  cardTitle:    { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  cardSub:      { fontSize: 12, marginBottom: 14 },

  pbRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  pbIcon:       { fontSize: 20, width: 28, textAlign: 'center' },
  pbLabel:      { flex: 1, fontSize: 14 },
  pbValue:      { fontSize: 16, fontWeight: '800' },

  splitRow:     { marginTop: 12, marginBottom: 14 },
  splitBar:     { height: 14, borderRadius: 7, flexDirection: 'row', overflow: 'hidden', backgroundColor: colors.border },
  splitFill:    { height: '100%' },
  splitLegend:  { gap: 8 },
  splitLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  splitDot:     { width: 10, height: 10, borderRadius: 5 },
  splitLegendText: { fontSize: 13 },

  muscleRow:    { marginBottom: 10 },
  muscleLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  muscleDot:    { width: 10, height: 10, borderRadius: 5 },
  muscleName:   { flex: 1, fontSize: 13, fontWeight: '600' },
  musclePct:    { fontSize: 12 },
  muscleBarBg:  { height: 6, borderRadius: 3 },
  muscleBarFill:{ height: 6, borderRadius: 3 },

  heatLegend:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, justifyContent: 'flex-end' },
  heatLegendLabel: { fontSize: 10 },
  heatCell:     { width: 11, height: 11, borderRadius: 2 },

  emptyWrap:    { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
  emptyTitle:   { fontSize: 22, fontWeight: '800', marginBottom: 10 },
  emptySub:     { fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
});
