// v2.0 — Performance sub-tab.
//
// Five sections (top → bottom):
//   1. Volume chart    — KM/TIME/ACTIVITIES summary + SVG bar chart (week/month toggle)
//   2. Personal Records — hexagon grid for 1K / 5K / 10K / Half / Marathon / 50K / 100K
//   3. Completed Plans — empty state for v2.0 (real wiring in v2.1)
//   4. Achievements    — derived milestones (First run, First 5K, Longest run, etc.)
//   5. All-Time Stats  — icon list aggregating logs + run_activities
//
// All computations are inline-ish; if this grows beyond ~700 lines we'll
// split into per-section files under ./perf/.
//
// PRs are km-based only for v2.0. Mile-based (1MI / 2MI / 5MI / 10MI) need
// path-walking sliding windows (splits are per-km) and ship in v2.1.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Rect, Polygon, Text as SvgText } from 'react-native-svg';
import useColors from '../../lib/useColors';
import useStore from '../../store/useStore';
import { listRunActivities } from '../../lib/runActivities';

// ── Constants ────────────────────────────────────────────────────────────────

// Milestone definitions. Order = display order in the grid.
const PR_MILESTONES = [
  { id: '1k',   km: 1,    label: '1K',   color: '#94a3b8' },
  { id: '5k',   km: 5,    label: '5K',   color: '#3b82f6' },
  { id: '10k',  km: 10,   label: '10K',  color: '#eab308' },
  { id: 'half', km: 21.1, label: 'Half', color: '#10b981' },
  { id: 'full', km: 42.2, label: 'Full', color: '#ef4444' },
  { id: '50k',  km: 50,   label: '50K',  color: '#84cc16' },
  { id: '100k', km: 100,  label: '100K', color: '#a855f7' },
];

// ── Computations ─────────────────────────────────────────────────────────────

function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m ${r}s`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}

function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function shortDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

// All-time aggregates over both runs (GPS) and logs (everything else).
function computeAllTime(logs, runs) {
  const totalActivities = (logs?.length || 0) + 0; // runs already in logs as cardio
  let totalDistKm = 0;
  let totalSec    = 0;
  let longestKm   = 0;
  const planCounts = { run: 0, strength: 0, mobility: 0, crossfit: 0, hyrox: 0 };

  for (const l of (logs || [])) {
    totalSec += (l.duration || 0) * 60;
    if (l.distance) {
      totalDistKm += Number(l.distance);
      if (Number(l.distance) > longestKm) longestKm = Number(l.distance);
    }
  }
  // Augment longest from runs (in case a run lives in run_activities without
  // a corresponding log entry — rare but defensive).
  for (const r of (runs || [])) {
    if ((r.distanceKm || 0) > longestKm) longestKm = r.distanceKm;
  }

  return {
    totalActivities,
    totalDistKm,
    totalSec,
    longestKm,
    planCounts,
  };
}

// Bucket distance per week/month for the volume chart. Returns an array of
// { label, distanceKm, totalSec, activities } sorted oldest → newest.
function computeVolume(logs, runs, granularity) {
  const startOfBucket = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    if (granularity === 'week') {
      // Roll back to Monday (ISO week start)
      const dow = (x.getDay() + 6) % 7; // 0 = Monday
      x.setDate(x.getDate() - dow);
    } else {
      x.setDate(1);
    }
    return x;
  };

  const buckets = new Map();
  const allActivities = [
    ...(logs || []).map(l => ({
      ts: l.ts || (l.id && Number(l.id)) || Date.parse(l.date || ''),
      km: l.distance ? Number(l.distance) : 0,
      sec: (l.duration || 0) * 60,
    })),
  ];

  for (const a of allActivities) {
    if (!a.ts) continue;
    const bk = startOfBucket(new Date(a.ts)).getTime();
    if (!buckets.has(bk)) buckets.set(bk, { ts: bk, km: 0, sec: 0, n: 0 });
    const b = buckets.get(bk);
    b.km += a.km;
    b.sec += a.sec;
    b.n += 1;
  }

  // Fill in empty buckets between the oldest and now, then keep last 8.
  if (buckets.size === 0) return [];
  const sorted = [...buckets.values()].sort((a, b) => a.ts - b.ts);
  const start = sorted[0].ts;
  const filled = [];
  const stepMs = granularity === 'week' ? 7 * 86400000 : 0; // months handled differently
  let cursor = new Date(start);
  const end = Date.now();
  while (cursor.getTime() <= end) {
    const t = startOfBucket(cursor).getTime();
    const existing = buckets.get(t) || { ts: t, km: 0, sec: 0, n: 0 };
    filled.push(existing);
    if (granularity === 'week') {
      cursor = new Date(cursor.getTime() + stepMs);
    } else {
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  return filled.slice(-8).map(b => ({
    label: granularity === 'week'
      ? new Date(b.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : new Date(b.ts).toLocaleDateString('en-US', { month: 'short' }),
    distanceKm: b.km,
    totalSec:   b.sec,
    activities: b.n,
  }));
}

// Personal records — best time at each km milestone, computed via a sliding
// window over each run's splits array.
function computePRs(runs) {
  const out = {}; // id → { timeSec, ts }
  for (const r of (runs || [])) {
    const splits = Array.isArray(r.splits) ? r.splits : [];
    if (splits.length === 0) continue;
    const ts = new Date(r.startedAt).getTime();

    for (const milestone of PR_MILESTONES) {
      const windowKm = Math.ceil(milestone.km);
      if (splits.length < windowKm) continue;
      // Sliding window of length = windowKm
      let bestSec = Infinity;
      for (let i = 0; i + windowKm <= splits.length; i++) {
        let sec = 0;
        for (let j = 0; j < windowKm; j++) sec += splits[i + j].timeSec || 0;
        if (sec > 0 && sec < bestSec) bestSec = sec;
      }
      if (bestSec === Infinity) continue;
      // Scale to fractional km if milestone isn't a whole km (Half=21.1, Full=42.2)
      const scaled = bestSec * (milestone.km / windowKm);
      const prior = out[milestone.id];
      if (!prior || scaled < prior.timeSec) {
        out[milestone.id] = { timeSec: scaled, ts };
      }
    }
  }
  return out;
}

// Achievements — derived milestones from logs + runs.
function computeAchievements(logs, runs) {
  const list = [];
  const sortedLogs = [...(logs || [])].sort((a, b) =>
    (a.ts || Number(a.id) || 0) - (b.ts || Number(b.id) || 0));

  const firstByType = (t) => sortedLogs.find(l => (l.type || '').toLowerCase() === t);
  const firstRun      = firstByType('cardio');
  const firstStrength = firstByType('strength');

  if (firstRun) {
    list.push({
      id: 'first-run', label: 'First run', emoji: '🏃',
      ts: firstRun.ts || Number(firstRun.id), color: '#10b981',
    });
  }
  if (firstStrength) {
    list.push({
      id: 'first-strength', label: 'First strength session', emoji: '🏋️',
      ts: firstStrength.ts || Number(firstStrength.id), color: '#3b82f6',
    });
  }

  // First 5K + 10K — first run whose distance crosses the threshold.
  const runsByTime = [...(runs || [])].sort((a, b) =>
    new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  const first5K  = runsByTime.find(r => (r.distanceKm || 0) >= 5);
  const first10K = runsByTime.find(r => (r.distanceKm || 0) >= 10);
  const firstHalf= runsByTime.find(r => (r.distanceKm || 0) >= 21.1);

  if (first5K)   list.push({ id: 'first-5k',   label: 'First 5K',           emoji: '🎯', ts: new Date(first5K.startedAt).getTime(),   color: '#3b82f6' });
  if (first10K)  list.push({ id: 'first-10k',  label: 'First 10K',          emoji: '⭐', ts: new Date(first10K.startedAt).getTime(),  color: '#eab308' });
  if (firstHalf) list.push({ id: 'first-half', label: 'First Half Marathon',emoji: '🏆', ts: new Date(firstHalf.startedAt).getTime(), color: '#10b981' });

  // Longest run — only show if user has at least 3 runs (otherwise everyone
  // gets a "longest run = 1km" achievement after their first run which is silly).
  if (runsByTime.length >= 3) {
    const longest = runsByTime.reduce((a, r) => (r.distanceKm || 0) > (a.distanceKm || 0) ? r : a, runsByTime[0]);
    if (longest?.distanceKm) {
      list.push({
        id: 'longest-run', label: `Longest run: ${longest.distanceKm.toFixed(1)} km`, emoji: '🚀',
        ts: new Date(longest.startedAt).getTime(), color: '#a855f7',
      });
    }
  }

  return list.sort((a, b) => b.ts - a.ts);
}

// ── Render helpers ───────────────────────────────────────────────────────────

// Renders a hexagon SVG with the milestone label + optional time/date below.
function HexBadge({ milestone, pr, colors }) {
  const size = 96;
  const w = size;
  const h = size * 0.866;
  const cx = w / 2;
  const cy = h / 2;
  // Pointy-top hexagon vertices (60° rotated from flat-top)
  const pts = [
    [cx, cy - h / 2],
    [cx + w / 2, cy - h / 4],
    [cx + w / 2, cy + h / 4],
    [cx, cy + h / 2],
    [cx - w / 2, cy + h / 4],
    [cx - w / 2, cy - h / 4],
  ].map(p => p.join(',')).join(' ');

  const locked = !pr;
  const fill   = locked ? '#1c1c1c' : milestone.color + '33';
  const stroke = locked ? '#333'    : milestone.color;

  return (
    <View style={{ alignItems: 'center', width: 100, marginVertical: 8 }}>
      <Svg width={w} height={h}>
        <Polygon points={pts} fill={fill} stroke={stroke} strokeWidth={2} />
        <SvgText
          x={cx} y={cy + 2}
          textAnchor="middle" alignmentBaseline="middle"
          fontSize="20" fontWeight="900"
          fill={locked ? '#555' : '#fff'}
        >
          {milestone.label}
        </SvgText>
      </Svg>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 6 }}>{milestone.label}</Text>
      {pr ? (
        <>
          <Text style={{ color: colors.text2, fontSize: 12, fontWeight: '700', marginTop: 2 }}>
            {fmtClock(pr.timeSec)}
          </Text>
          <Text style={{ color: colors.text3, fontSize: 11, marginTop: 1 }}>
            {shortDate(pr.ts)}
          </Text>
        </>
      ) : null}
    </View>
  );
}

// SVG bar chart for the volume section.
function VolumeBars({ buckets, colors }) {
  const chartW = 320;
  const chartH = 140;
  const barGap = 8;
  const maxKm  = Math.max(1, ...buckets.map(b => b.distanceKm || 0));
  const barW   = (chartW - barGap * (buckets.length - 1)) / Math.max(1, buckets.length);

  return (
    <View style={{ alignItems: 'center', marginTop: 8 }}>
      <Svg width={chartW} height={chartH + 22}>
        {buckets.map((b, i) => {
          const h = Math.max(2, (b.distanceKm / maxKm) * chartH);
          const x = i * (barW + barGap);
          const y = chartH - h;
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={y} width={barW} height={h} rx={4} fill={colors.accent} opacity={b.distanceKm > 0 ? 1 : 0.18} />
              <SvgText
                x={x + barW / 2} y={chartH + 14}
                textAnchor="middle" fontSize="10" fontWeight="700"
                fill={colors.text3}
              >
                {b.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PerformanceTab() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { logs, user } = useStore();

  const [runs, setRuns]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [granularity, setGranularity] = useState('week'); // 'week' | 'month'

  const loadRuns = useCallback(async () => {
    if (!user?.id) { setRuns([]); setLoading(false); return; }
    try {
      const list = await listRunActivities({ limit: 500 });
      setRuns(list || []);
    } catch { /* fall through */ }
    finally {
      setLoading(false);
      setRefresh(false);
    }
  }, [user?.id]);

  useEffect(() => { loadRuns(); }, [loadRuns]);
  useFocusEffect(useCallback(() => { loadRuns(); }, [loadRuns]));

  const allTime      = useMemo(() => computeAllTime(logs, runs), [logs, runs]);
  const volume       = useMemo(() => computeVolume(logs, runs, granularity), [logs, runs, granularity]);
  const prs          = useMemo(() => computePRs(runs), [runs]);
  const achievements = useMemo(() => computeAchievements(logs, runs), [logs, runs]);

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const volumeKmTotal = volume.reduce((s, b) => s + b.distanceKm, 0);
  const volumeSecTotal = volume.reduce((s, b) => s + b.totalSec, 0);
  const volumeActsTotal = volume.reduce((s, b) => s + b.activities, 0);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: 32 }}
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
      {/* ── Volume chart ──────────────────────────────────────────────────── */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <View style={styles.volumeHeader}>
          <Text style={[styles.volumeRange, { color: colors.text }]}>
            {volume[0]?.label ?? '—'}{volume.length > 1 ? ` – ${volume[volume.length - 1].label}` : ''}
          </Text>
          <TouchableOpacity
            onPress={() => setGranularity(g => g === 'week' ? 'month' : 'week')}
            style={styles.granPill}
            activeOpacity={0.7}
          >
            <Text style={{ color: colors.text3, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
              VIEW BY: {granularity.toUpperCase()} ▼
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.volumeStatsRow}>
          <VolStat label="KILOMETERS" value={volumeKmTotal.toFixed(2)} colors={colors} />
          <VolStat label="TIME"       value={fmtTime(volumeSecTotal)}  colors={colors} />
          <VolStat label="ACTIVITIES" value={String(volumeActsTotal)}  colors={colors} />
        </View>
        {volume.length > 0
          ? <VolumeBars buckets={volume} colors={colors} />
          : <Text style={[styles.emptyChart, { color: colors.text3 }]}>No activity yet — log a workout to fill this chart.</Text>
        }
      </View>

      {/* ── Personal Records ─────────────────────────────────────────────── */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Records</Text>
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <View style={styles.prGrid}>
          {PR_MILESTONES.map(m => (
            <HexBadge key={m.id} milestone={m} pr={prs[m.id] || null} colors={colors} />
          ))}
        </View>
      </View>

      {/* ── Completed Plans (empty state for v2.0) ───────────────────────── */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Completed Plans</Text>
      <View style={[styles.section, { backgroundColor: colors.surface, alignItems: 'center', paddingVertical: 36 }]}>
        <Text style={{ color: colors.text3, fontSize: 14 }}>No completed plans (yet!)</Text>
      </View>

      {/* ── Achievements ─────────────────────────────────────────────────── */}
      <View style={styles.achievementsHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Achievements</Text>
      </View>
      {achievements.length === 0 ? (
        <View style={[styles.section, { backgroundColor: colors.surface, alignItems: 'center', paddingVertical: 36 }]}>
          <Text style={{ color: colors.text3, fontSize: 14 }}>Log your first workout to start earning these.</Text>
        </View>
      ) : (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.achGrid}>
            {achievements.map(a => (
              <View key={a.id} style={styles.achBadge}>
                <View style={[styles.achCircle, { backgroundColor: a.color + '33', borderColor: a.color }]}>
                  <Text style={{ fontSize: 28 }}>{a.emoji}</Text>
                </View>
                <Text style={[styles.achLabel, { color: colors.text }]} numberOfLines={2}>{a.label}</Text>
                <Text style={[styles.achDate, { color: colors.text3 }]}>{shortDate(a.ts)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── All-Time Stats ───────────────────────────────────────────────── */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>All-Time Stats</Text>
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <StatRow icon="🛣️"  label="TOTAL DISTANCE"  value={`${allTime.totalDistKm.toFixed(2)} km`} colors={colors} />
        <StatRow icon="🏃"  label="TOTAL ACTIVITIES" value={String(allTime.totalActivities)}        colors={colors} />
        <StatRow icon="⏱️"  label="TOTAL TIME"       value={fmtTime(allTime.totalSec)}              colors={colors} />
        <StatRow icon="🚀"  label="LONGEST RUN"      value={`${allTime.longestKm.toFixed(2)} km`}   colors={colors} last />
      </View>
    </ScrollView>
  );
}

function VolStat({ label, value, colors }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.text3, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 4 }}>{value}</Text>
    </View>
  );
}

function StatRow({ icon, label, value, colors, last }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomColor: colors.border, borderBottomWidth: last ? 0 : 1 }]}>
      <Text style={{ fontSize: 24, marginRight: 14 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text3, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>{label}</Text>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  section: { marginHorizontal: 14, marginTop: 14, borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 22, fontWeight: '800', paddingHorizontal: 18, marginTop: 24, marginBottom: 0 },

  volumeHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  volumeRange:    { fontSize: 16, fontWeight: '800' },
  granPill:       { paddingHorizontal: 10, paddingVertical: 6 },
  volumeStatsRow: { flexDirection: 'row', marginTop: 14, marginBottom: 4 },
  emptyChart:     { textAlign: 'center', marginTop: 16, marginBottom: 16, fontSize: 13 },

  prGrid:  { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' },

  achievementsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, marginTop: 24 },
  achGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around' },
  achBadge: { width: 100, alignItems: 'center', marginVertical: 10 },
  achCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  achLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  achDate: { fontSize: 11, marginTop: 2 },
});
