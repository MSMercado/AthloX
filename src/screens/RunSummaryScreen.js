// RunSummaryScreen — Strava/Runna-style post-run detail.
//
// Renders: hero stats + SVG route map + per-km splits + pace chart + elevation
// chart + AI Workout Insights. Loads the activity by id (passed via navigation
// param), so this same screen serves both the post-run flow and the history
// re-open flow.

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Polyline, Circle, Line, Path as SvgPath, Text as SvgText, Rect } from 'react-native-svg';

// Feature flag — flip this to `true` once the Google Maps Android API key is
// set up in app.json. Until then we render the v1.1.0 SVG polyline (dark
// canvas + orange line), which works with zero external dependencies and zero
// API setup. The SVG version isn't as Strava-grade, but it doesn't break the
// build either.
//
// To enable Google Maps:
//   1. Get a key from Google Cloud Console (Maps SDK for Android, restricted
//      to package com.athlox.app + your release SHA-1).
//   2. Paste it into app.json under android.config.googleMaps.apiKey.
//   3. Flip USE_GOOGLE_MAPS to true here.
//   4. Rebuild the APK.
//
// iOS picks up Apple Maps automatically — no key, no flag flip needed there
// (handled inside the Google-Maps branch via Platform.OS check).
const USE_GOOGLE_MAPS = true;

// Lazy-load react-native-maps so the SVG-only path can ship without the
// package installed. The require() only runs when the flag is true.
let MapView, MapPolyline, Marker, PROVIDER_GOOGLE;
if (USE_GOOGLE_MAPS) {
  // eslint-disable-next-line global-require
  const rnMaps  = require('react-native-maps');
  MapView       = rnMaps.default;
  MapPolyline   = rnMaps.Polyline;
  Marker        = rnMaps.Marker;
  PROVIDER_GOOGLE = rnMaps.PROVIDER_GOOGLE;
}

import useColors from '../lib/useColors';
import { supabase } from '../lib/supabase';
import {
  getRunActivity,
  updateRunActivity,
  deleteRunActivity,
} from '../lib/runActivities';

// ─── Formatting helpers ──────────────────────────────────────────────────────
function fmtKm(km)        { return `${(km || 0).toFixed(2)} km`; }
function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}
function fmtPace(minPerKm) {
  if (!minPerKm || !isFinite(minPerKm)) return '—';
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ─── SVG Route Map (v1.1.0 fallback) ─────────────────────────────────────────
// Used when USE_GOOGLE_MAPS is false. Renders the polyline on a black canvas
// with the AthloX orange accent — no API key, no billing, no native module.
// Loses map context (no streets), but the route shape is preserved exactly.
function RouteMapSvg({ path, accentColor, width, height }) {
  if (!Array.isArray(path) || path.length < 2) return null;
  const PAD = 16;

  let minLat =  Infinity, maxLat = -Infinity;
  let minLng =  Infinity, maxLng = -Infinity;
  for (const p of path) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const latSpan = Math.max(maxLat - minLat, 1e-6);
  const midLat  = (minLat + maxLat) / 2;
  const lngSpan = Math.max((maxLng - minLng) * Math.cos(midLat * Math.PI / 180), 1e-6);

  const aspect    = lngSpan / latSpan;
  const canvasW   = width  - PAD * 2;
  const canvasH   = height - PAD * 2;
  const canvasAsp = canvasW / canvasH;

  let drawW, drawH;
  if (aspect > canvasAsp) { drawW = canvasW; drawH = canvasW / aspect; }
  else                    { drawH = canvasH; drawW = canvasH * aspect; }
  const offsetX = (width  - drawW) / 2;
  const offsetY = (height - drawH) / 2;

  const project = (p) => {
    const x = ((p.lng - minLng) * Math.cos(midLat * Math.PI / 180)) / lngSpan * drawW + offsetX;
    const y = (1 - (p.lat - minLat) / latSpan) * drawH + offsetY;
    return [x, y];
  };

  const points = path.map(project).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [sx, sy] = project(path[0]);
  const [ex, ey] = project(path[path.length - 1]);

  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} rx={16} fill="#000" />
      <Polyline
        points={points}
        stroke={accentColor}
        strokeWidth={3.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle cx={sx} cy={sy} r={7} fill="#22c55e" stroke="#fff" strokeWidth={2} />
      <Circle cx={ex} cy={ey} r={7} fill="#ef4444" stroke="#fff" strokeWidth={2} />
    </Svg>
  );
}

// ─── Google-Maps-backed Route Map ────────────────────────────────────────────
// Renders the GPS polyline on top of real Google Maps tiles. Region auto-fits
// to the path's bounding box with padding so the whole route is visible.
function RouteMapGoogle({ path, accentColor, width, height }) {
  if (!Array.isArray(path) || path.length < 2) return null;

  // Compute the centre + span for the initial region. Adding 25% padding around
  // the bounding box so the polyline doesn't kiss the edges of the map.
  let minLat =  Infinity, maxLat = -Infinity;
  let minLng =  Infinity, maxLng = -Infinity;
  for (const p of path) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const latDelta = Math.max((maxLat - minLat) * 1.25, 0.002);
  const lngDelta = Math.max((maxLng - minLng) * 1.25, 0.002);
  const region = {
    latitude:       (minLat + maxLat) / 2,
    longitude:      (minLng + maxLng) / 2,
    latitudeDelta:  latDelta,
    longitudeDelta: lngDelta,
  };

  // Convert path (with `lat`/`lng`) to the {latitude, longitude} shape
  // that react-native-maps expects.
  const coords = path.map(p => ({ latitude: p.lat, longitude: p.lng }));
  const start = coords[0];
  const end   = coords[coords.length - 1];

  return (
    <View style={{ width, height, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
      <MapView
        // On Android we force Google Maps for the familiar Strava-grade tiles.
        // On iOS we let react-native-maps default to Apple Maps — it's free,
        // native, billing-free, and looks at home on iOS. Switch to
        // PROVIDER_GOOGLE here if you ever want consistent Google branding
        // across both platforms (will require a separate iOS API key).
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={{ flex: 1 }}
        initialRegion={region}
        // Lock the map down — this is a summary view, not an interactive map
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        loadingEnabled
        loadingIndicatorColor={accentColor}
        loadingBackgroundColor="#000"
      >
        <MapPolyline
          coordinates={coords}
          strokeColor={accentColor}
          strokeWidth={5}
          lineCap="round"
          lineJoin="round"
        />
        <Marker
          coordinate={start}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={{
            width: 16, height: 16, borderRadius: 8,
            backgroundColor: '#22c55e',
            borderWidth: 2, borderColor: '#fff',
          }} />
        </Marker>
        <Marker
          coordinate={end}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={{
            width: 16, height: 16, borderRadius: 8,
            backgroundColor: '#ef4444',
            borderWidth: 2, borderColor: '#fff',
          }} />
        </Marker>
      </MapView>
    </View>
  );
}

// Dispatcher — picks the SVG fallback or the Google-Maps-backed renderer based
// on the USE_GOOGLE_MAPS flag at the top of this file.
function RouteMap(props) {
  return USE_GOOGLE_MAPS
    ? <RouteMapGoogle {...props} />
    : <RouteMapSvg    {...props} />;
}

// ─── SVG Line Chart (for pace + elevation) ───────────────────────────────────
function LineChart({ values, width, height, color, lowerIsBetter = false, formatY }) {
  if (!Array.isArray(values) || values.length < 2) return null;
  const PAD_L = 36, PAD_R = 12, PAD_T = 12, PAD_B = 22;
  const drawW = width  - PAD_L - PAD_R;
  const drawH = height - PAD_T - PAD_B;

  const yVals = values.map(v => v.y).filter(v => typeof v === 'number' && isFinite(v));
  if (yVals.length < 2) return null;
  const minY = Math.min(...yVals);
  const maxY = Math.max(...yVals);
  const ySpan = Math.max(maxY - minY, 1e-6);

  const xVals = values.map(v => v.x);
  const minX = Math.min(...xVals);
  const maxX = Math.max(...xVals);
  const xSpan = Math.max(maxX - minX, 1e-6);

  const px = (x) => PAD_L + (x - minX) / xSpan * drawW;
  const py = (y) => PAD_T + (1 - (y - minY) / ySpan) * drawH;

  // Build path
  let d = '';
  values.forEach((v, i) => {
    if (typeof v.y !== 'number' || !isFinite(v.y)) return;
    d += (d ? ' L ' : 'M ') + `${px(v.x).toFixed(1)} ${py(v.y).toFixed(1)}`;
  });

  // 3 horizontal grid lines + axis labels
  const ticks = [minY, (minY + maxY) / 2, maxY];

  return (
    <Svg width={width} height={height}>
      {ticks.map((t, i) => {
        const y = py(t);
        return (
          <React.Fragment key={i}>
            <Line x1={PAD_L} x2={width - PAD_R} y1={y} y2={y} stroke="#262626" strokeWidth={1} />
            <SvgText x={PAD_L - 6} y={y + 4} fill="#888" fontSize={10} textAnchor="end">
              {formatY ? formatY(lowerIsBetter ? t : t) : t.toFixed(0)}
            </SvgText>
          </React.Fragment>
        );
      })}
      <SvgPath d={d} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {/* X-axis range */}
      <SvgText x={PAD_L} y={height - 6} fill="#888" fontSize={10}>0 km</SvgText>
      <SvgText x={width - PAD_R} y={height - 6} fill="#888" fontSize={10} textAnchor="end">
        {maxX.toFixed(1)} km
      </SvgText>
    </Svg>
  );
}

// ─── Splits bar list ─────────────────────────────────────────────────────────
function SplitsList({ splits, accentColor }) {
  if (!Array.isArray(splits) || splits.length === 0) return null;
  const paces = splits.map(s => s.pace).filter(p => p && isFinite(p));
  if (paces.length === 0) return null;
  const fastest = Math.min(...paces);
  const slowest = Math.max(...paces);
  const range = Math.max(slowest - fastest, 0.01);

  return (
    <View style={{ gap: 6 }}>
      {splits.map((s, i) => {
        const pct = (s.pace - fastest) / range;        // 0 = fastest, 1 = slowest
        const fill = Math.max(0.15, 1 - pct * 0.7);    // wider bar = faster
        const isSlowest = s.pace === slowest && splits.length > 1;
        const isFastest = s.pace === fastest && splits.length > 1;
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ width: 36, color: '#888', fontSize: 12, fontWeight: '600' }}>{s.km} km</Text>
            <View style={{ flex: 1, height: 10, backgroundColor: '#1a1a1a', borderRadius: 5, overflow: 'hidden' }}>
              <View style={{
                width: `${fill * 100}%`,
                height: '100%',
                backgroundColor: isSlowest ? '#ef4444' : isFastest ? '#22c55e' : accentColor,
              }} />
            </View>
            <Text style={{ width: 64, color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'right' }}>
              {fmtPace(s.pace)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── AI Insights via groq-proxy ──────────────────────────────────────────────
async function fetchInsights(activity) {
  const compactSplits = (activity.splits || [])
    .map(s => `km${s.km}: ${fmtPace(s.pace)}`)
    .join(', ');
  const prompt = `You are speaking DIRECTLY to a runner who just finished a workout. Address them as "you" / "your" throughout. NEVER use third person ("they", "the runner", "the athlete", "the user"). Talk to them like a coach standing next to them.

The activity:
Type: ${activity.activityType}
Distance: ${activity.distanceKm.toFixed(2)} km
Time: ${fmtTime(activity.durationSec)}
Average pace: ${fmtPace(activity.avgPaceMinPerKm)}
Best pace (30s window): ${activity.maxPaceMinPerKm ? fmtPace(activity.maxPaceMinPerKm) : 'n/a'}
Elevation gain: ${activity.elevationGainM != null ? activity.elevationGainM + ' m' : 'n/a'}
Splits: ${compactSplits || 'n/a'}

Write 3-4 sentences (~70 words). Include: one specific thing you did well, one observation about your pacing or splits, one concrete suggestion for next time. Be encouraging but specific. No greetings, no markdown.

CORRECT examples (use this voice):
- "You held a remarkably steady pace through kms 1-3 — that's textbook race execution."
- "Your km 4 was 30 seconds slower than km 3; consider easing in earlier next time so you don't fade."
- "Strong finish — your last kilometre was your fastest. Try carrying that aerobic base into the start of your next session."

INCORRECT examples (do NOT do this):
- "The runner held a steady pace..." (third person, bad)
- "Their splits show..." (third person, bad)
- "The athlete should focus on..." (third person, bad)`;

  const { data, error } = await supabase.functions.invoke('groq-proxy', {
    body: {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 250,
      temperature: 0.7,
    },
  });
  if (error) throw new Error(error.message || 'Insights generation failed');
  if (data?.error) throw new Error(data.error?.message || data.error);
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty insights response');
  return text;
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function RunSummaryScreen() {
  const colors = useColors();
  const navigation = useNavigation();
  const route = useRoute();
  const { activityId } = route.params || {};

  const [activity, setActivity]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [insightsLoading, setInsLoad] = useState(false);
  const [error, setError]           = useState(null);

  // Load the activity by id
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const a = await getRunActivity(activityId);
        if (cancelled) return;
        if (!a) {
          setError('Run not found');
          setLoading(false);
          return;
        }
        setActivity(a);
        setLoading(false);
        // If insights aren't generated yet, fire one off in the background
        if (!a.aiInsights) {
          setInsLoad(true);
          fetchInsights(a)
            .then(text => updateRunActivity(a.id, { aiInsights: text }))
            .then(updated => { if (!cancelled) setActivity(updated); })
            .catch(err => console.warn('[RunSummary] insights failed:', err?.message))
            .finally(() => { if (!cancelled) setInsLoad(false); });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load run');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activityId]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete this run?',
      'This permanently removes the route, splits, and AI insights.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRunActivity(activityId);
              navigation.goBack();
            } catch (e) {
              Alert.alert('Could not delete', e?.message || 'Try again');
            }
          },
        },
      ]
    );
  }, [activityId, navigation]);

  // Prepare chart data — once the activity is loaded
  const { paceSeries, elevationSeries, hasElevation } = useMemo(() => {
    if (!activity?.path?.length) return { paceSeries: [], elevationSeries: [], hasElevation: false };
    const path = activity.path;
    let cumKm = 0;
    const pace = [];
    const elev = [];
    const WINDOW_MS = 30_000;
    let hasAlt = false;
    for (let i = 1; i < path.length; i++) {
      // distance step in km
      const d = haversineKm(path[i - 1], path[i]);
      cumKm += d;
      // rolling 30s pace
      let j = i - 1;
      let dist = d;
      while (j > 0 && path[i].ts - path[j].ts < WINDOW_MS) {
        j--;
        dist += haversineKm(path[j], path[j + 1]);
      }
      const dt = (path[i].ts - path[j].ts) / 60_000; // minutes
      const p = (dist > 0.05 && dt > 0) ? dt / dist : null;
      if (p != null) pace.push({ x: cumKm, y: p });
      const a = path[i].alt;
      if (typeof a === 'number') {
        hasAlt = true;
        elev.push({ x: cumKm, y: a });
      }
    }
    return { paceSeries: pace, elevationSeries: elev, hasElevation: hasAlt };
  }, [activity]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading your run…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !activity) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
        <View style={styles.loadingState}>
          <Text style={[styles.loadingText, { color: '#ef4444' }]}>{error || 'Run not available'}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const accentCol = colors.accent;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={handleDelete} style={styles.headerAction}>
          <Text style={styles.headerActionText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.heroSection}>
          <Text style={styles.heroDate}>{fmtDate(activity.startedAt)}</Text>
          <Text style={styles.heroTitle}>
            {activity.activityType.charAt(0).toUpperCase() + activity.activityType.slice(1)}
          </Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{fmtKm(activity.distanceKm)}</Text>
              <Text style={styles.heroStatLabel}>Distance</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{fmtTime(activity.durationSec)}</Text>
              <Text style={styles.heroStatLabel}>Time</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{fmtPace(activity.avgPaceMinPerKm)}</Text>
              <Text style={styles.heroStatLabel}>Avg Pace</Text>
            </View>
          </View>
        </View>

        {/* Route map */}
        {activity.path?.length >= 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Route</Text>
            <RouteMap path={activity.path} accentColor={accentCol} width={340} height={220} />
          </View>
        )}

        {/* Secondary stats */}
        <View style={styles.section}>
          <View style={styles.secondaryGrid}>
            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryStatValue}>{activity.elevationGainM ?? '—'}{activity.elevationGainM != null ? ' m' : ''}</Text>
              <Text style={styles.secondaryStatLabel}>Elevation Gain</Text>
            </View>
            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryStatValue}>{activity.maxPaceMinPerKm ? fmtPace(activity.maxPaceMinPerKm).replace(' /km','') : '—'}</Text>
              <Text style={styles.secondaryStatLabel}>Best Pace</Text>
            </View>
            <View style={styles.secondaryStat}>
              <Text style={styles.secondaryStatValue}>{activity.calories ?? '—'}{activity.calories != null ? ' kcal' : ''}</Text>
              <Text style={styles.secondaryStatLabel}>Calories</Text>
            </View>
          </View>
        </View>

        {/* Splits */}
        {activity.splits?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Splits</Text>
            <SplitsList splits={activity.splits} accentColor={accentCol} />
          </View>
        )}

        {/* Pace chart */}
        {paceSeries.length >= 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Pace</Text>
            <LineChart
              values={paceSeries}
              width={340}
              height={140}
              color={accentCol}
              lowerIsBetter
              formatY={(v) => fmtPace(v).replace(' /km', '')}
            />
          </View>
        )}

        {/* Elevation chart */}
        {hasElevation && elevationSeries.length >= 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Elevation</Text>
            <LineChart
              values={elevationSeries}
              width={340}
              height={140}
              color="#a3e635"
              formatY={(v) => `${Math.round(v)}m`}
            />
          </View>
        )}

        {/* AI Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Workout Insights</Text>
          <View style={[styles.insightBox, { borderColor: accentCol + '55' }]}>
            {insightsLoading && !activity.aiInsights ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator size="small" color={accentCol} />
                <Text style={styles.insightLoadingText}>AthloX Coach is analysing your run…</Text>
              </View>
            ) : activity.aiInsights ? (
              <Text style={styles.insightText}>{activity.aiInsights}</Text>
            ) : (
              <Text style={styles.insightLoadingText}>Insights will appear once your run is analysed.</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Local copy so this screen doesn't need to import from runActivities.js for one helper
function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const styles = StyleSheet.create({
  container:        { flex: 1 },
  loadingState:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  loadingText:      { color: '#fff', fontSize: 15 },

  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  backBtn:          { paddingVertical: 8, paddingRight: 12 },
  backBtnText:      { color: '#fff', fontSize: 15, fontWeight: '600' },
  headerAction:     { paddingVertical: 8, paddingHorizontal: 12 },
  headerActionText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },

  heroSection:      { paddingHorizontal: 24, paddingBottom: 24 },
  heroDate:         { color: '#888', fontSize: 13, fontWeight: '600' },
  heroTitle:        { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: 4, marginBottom: 18 },
  heroStatsRow:     { flexDirection: 'row', gap: 24 },
  heroStat:         { },
  heroStatValue:    { color: '#fff', fontSize: 20, fontWeight: '900' },
  heroStatLabel:    { color: '#888', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 2 },

  section:          { paddingHorizontal: 16, marginBottom: 24 },
  sectionLabel:     { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },

  secondaryGrid:    { flexDirection: 'row', backgroundColor: '#0f0f0f', borderRadius: 14, padding: 16, gap: 16 },
  secondaryStat:    { flex: 1 },
  secondaryStatValue:{ color: '#fff', fontSize: 17, fontWeight: '800' },
  secondaryStatLabel:{ color: '#888', fontSize: 10, fontWeight: '600', marginTop: 3, letterSpacing: 0.4, textTransform: 'uppercase' },

  insightBox:       { backgroundColor: '#0f0f0f', borderRadius: 14, padding: 16, borderWidth: 1 },
  insightText:      { color: '#fff', fontSize: 14, lineHeight: 22 },
  insightLoadingText:{ color: '#888', fontSize: 13, fontStyle: 'italic' },
});
