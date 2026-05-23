// Wrapper for the `run_activities` Supabase table — saves/loads GPS-tracked
// runs and walks for the Run Summary screen and history.
//
// Schema (camelCase here, snake_case in DB):
//   id, userId, activityType, startedAt, durationSec, distanceKm,
//   avgPaceMinPerKm, maxPaceMinPerKm, elevationGainM, calories,
//   path: [{ lat, lng, alt, ts }],  splits: [{ km, timeSec, pace }],
//   aiInsights, createdAt

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const TABLE = 'run_activities';
const PENDING_KEY = 'wb_pendingRuns';

// Convert a row from DB (snake_case) into the shape used in JS code (camelCase).
function fromRow(row) {
  if (!row) return null;
  return {
    id:              row.id,
    userId:          row.user_id,
    activityType:    row.activity_type,
    startedAt:       row.started_at,
    durationSec:     row.duration_sec,
    distanceKm:      Number(row.distance_km),
    avgPaceMinPerKm: row.avg_pace_min_per_km != null ? Number(row.avg_pace_min_per_km) : null,
    maxPaceMinPerKm: row.max_pace_min_per_km != null ? Number(row.max_pace_min_per_km) : null,
    elevationGainM:  row.elevation_gain_m,
    calories:        row.calories,
    path:            Array.isArray(row.path)   ? row.path   : [],
    splits:          Array.isArray(row.splits) ? row.splits : [],
    aiInsights:      row.ai_insights,
    // v2.0 detail-screen columns. All optional — older rows return null.
    notes:           row.notes        ?? null,
    location:        row.location     ?? null,
    prescribed:      row.prescribed   ?? null,
    shoesId:         row.shoes_id     ?? null,
    avgHrBpm:        row.avg_hr_bpm   ?? null,
    maxHrBpm:        row.max_hr_bpm   ?? null,
    avgCadence:      row.avg_cadence  ?? null,
    createdAt:       row.created_at,
  };
}

// Convert a JS activity object into a DB row (snake_case).
function toRow(activity, userId) {
  return {
    user_id:                 userId,
    activity_type:           activity.activityType || 'run',
    started_at:              activity.startedAt,
    duration_sec:            Math.round(activity.durationSec || 0),
    distance_km:             Number((activity.distanceKm || 0).toFixed(3)),
    avg_pace_min_per_km:     activity.avgPaceMinPerKm != null ? Number(activity.avgPaceMinPerKm.toFixed(2)) : null,
    max_pace_min_per_km:     activity.maxPaceMinPerKm != null ? Number(activity.maxPaceMinPerKm.toFixed(2)) : null,
    elevation_gain_m:        activity.elevationGainM != null ? Math.round(activity.elevationGainM) : null,
    calories:                activity.calories != null ? Math.round(activity.calories) : null,
    path:                    Array.isArray(activity.path)   ? activity.path   : [],
    splits:                  Array.isArray(activity.splits) ? activity.splits : [],
    ai_insights:             activity.aiInsights || null,
    // v2.0 detail-screen columns. Anything optional — omit fields the run
    // doesn't carry rather than nulling them, so a row created before the
    // migration isn't accidentally cleared.
    ...(activity.notes        != null && { notes:        activity.notes        }),
    ...(activity.location     != null && { location:     activity.location     }),
    ...(activity.prescribed   != null && { prescribed:   activity.prescribed   }),
    ...(activity.shoesId      != null && { shoes_id:     activity.shoesId      }),
    ...(activity.avgHrBpm     != null && { avg_hr_bpm:   activity.avgHrBpm     }),
    ...(activity.maxHrBpm     != null && { max_hr_bpm:   activity.maxHrBpm     }),
    ...(activity.avgCadence   != null && { avg_cadence:  activity.avgCadence   }),
  };
}

// ── Offline queue ─────────────────────────────────────────────────────────
// When saveRunActivity fails (no internet / Supabase blip), TrackScreen calls
// enqueuePendingRun. On the next successful auth-state event in App.js we
// drain the queue and try to save each.

/** Push an unsaved activity onto the offline queue. */
export async function enqueuePendingRun(activity) {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.push(activity);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('[runActivities] enqueuePendingRun failed:', e?.message);
  }
}

/**
 * Drain the offline queue. Tries to save each pending activity; activities
 * that fail again stay in the queue for next time. Returns an array of saved
 * row objects (or [] if nothing succeeded / nothing pending).
 *
 * Safe to call repeatedly — fast no-op when the queue is empty.
 */
export async function drainPendingRuns() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return [];
    const saved = [];
    const stillFailing = [];
    for (const activity of list) {
      try {
        const result = await saveRunActivity(activity);
        saved.push(result);
      } catch (e) {
        // Network still down or auth lost — keep in queue
        stillFailing.push(activity);
      }
    }
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(stillFailing));
    return saved;
  } catch (e) {
    console.warn('[runActivities] drainPendingRuns failed:', e?.message);
    return [];
  }
}

/** Count items in the pending queue. Useful for UI badges (future). */
export async function getPendingRunCount() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return 0;
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}

/** Save a finished run. Returns the saved row (with new id) or throws. */
export async function saveRunActivity(activity) {
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) throw new Error('Must be signed in to save a run');
  const row = toRow(activity, user.id);
  const { data, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(error.message || 'Failed to save run');
  return fromRow(data);
}

/** Update an existing run (e.g. after AI insights are generated). */
export async function updateRunActivity(id, patch) {
  if (!id) throw new Error('id required');
  const dbPatch = {};
  if (patch.aiInsights !== undefined)       dbPatch.ai_insights        = patch.aiInsights;
  if (patch.avgPaceMinPerKm !== undefined)  dbPatch.avg_pace_min_per_km = patch.avgPaceMinPerKm;
  if (patch.maxPaceMinPerKm !== undefined)  dbPatch.max_pace_min_per_km = patch.maxPaceMinPerKm;
  if (patch.elevationGainM !== undefined)   dbPatch.elevation_gain_m   = patch.elevationGainM;
  if (patch.calories !== undefined)         dbPatch.calories           = patch.calories;
  if (patch.splits !== undefined)           dbPatch.splits             = patch.splits;
  const { data, error } = await supabase
    .from(TABLE)
    .update(dbPatch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message || 'Failed to update run');
  return fromRow(data);
}

/** List the current user's recent runs. */
export async function listRunActivities({ limit = 50 } = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message || 'Failed to list runs');
  return (data || []).map(fromRow);
}

/** Fetch a single activity by id. */
export async function getRunActivity(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message || 'Failed to fetch run');
  return fromRow(data);
}

/** Delete an activity. */
export async function deleteRunActivity(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message || 'Failed to delete run');
}

// ── Pure helpers (no Supabase) ───────────────────────────────────────────────

/**
 * Kalman-smooth a GPS path. Removes the small wobble that survives the
 * accuracy / warmup / max-speed filters in runTracking.js, producing a
 * visibly cleaner route polyline.
 *
 * How it works (1D Kalman, applied independently to lat and lng after
 * converting to local metres):
 *   1. Convert each (lat, lng) to (x, y) metres relative to the first point.
 *      Avoids per-degree distortion math and keeps variance units consistent.
 *   2. For each point, blend the running estimate with the new measurement,
 *      weighted by their respective uncertainties:
 *        - measurement variance = (point.accuracy ** 2)
 *        - estimate variance grows by Q*dt between samples (process noise)
 *      Kalman gain  K = estVar / (estVar + measVar)
 *      Updated pos  = est + K * (meas - est)
 *      Updated var  = (1 - K) * estVar
 *   3. Convert smoothed (x, y) back to (lat, lng).
 *
 * Process noise Q ~ 9 m²/s reflects the position uncertainty growth between
 * fixes for a person running. Bigger Q = trust measurements more = less smooth;
 * smaller Q = trust prediction more = smoother but laggier on real direction
 * changes.
 */
export function smoothPathKalman(path, { processNoiseM2PerS = 9 } = {}) {
  if (!Array.isArray(path) || path.length < 2) return path || [];

  // Origin (first point's lat/lng) for the local Cartesian frame
  const origin = { lat: path[0].lat, lng: path[0].lng };
  const cosLat0 = Math.cos(origin.lat * Math.PI / 180);
  // Convert lat/lng degrees to metres at the origin's latitude
  const M_PER_DEG_LAT = 111_320;
  const M_PER_DEG_LNG = 111_320 * cosLat0;

  // Project (lat, lng) → (x, y) in metres
  const toXY = (p) => ({
    x: (p.lng - origin.lng) * M_PER_DEG_LNG,
    y: (p.lat - origin.lat) * M_PER_DEG_LAT,
  });
  // Project (x, y) metres → (lat, lng)
  const toLatLng = (x, y) => ({
    lat: origin.lat + y / M_PER_DEG_LAT,
    lng: origin.lng + x / M_PER_DEG_LNG,
  });

  // Initialise estimate from first measurement
  const first = path[0];
  let estX = 0, estY = 0;
  // Default measurement variance if accuracy is null — assume 10m
  const defAcc = 10;
  let estVar = (first.accuracy ?? defAcc) ** 2;
  let lastTs = first.ts;

  const out = [{ ...first }];

  for (let i = 1; i < path.length; i++) {
    const p = path[i];
    const { x, y } = toXY(p);
    const measVar = (p.accuracy ?? defAcc) ** 2;
    const dt = Math.max(0.01, (p.ts - lastTs) / 1000);

    // Predict step — variance grows by process noise * dt
    estVar += processNoiseM2PerS * dt;

    // Update step — Kalman gain
    const K = estVar / (estVar + measVar);
    estX = estX + K * (x - estX);
    estY = estY + K * (y - estY);
    estVar = (1 - K) * estVar;

    const { lat, lng } = toLatLng(estX, estY);
    out.push({ ...p, lat, lng });
    lastTs = p.ts;
  }

  return out;
}

/** Haversine distance in km between two points. */
export function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Compute per-kilometre splits from a GPS path. Returns:
 *   [{ km, timeSec, pace }, ...]   pace = min per km
 */
export function computeSplits(path) {
  if (!Array.isArray(path) || path.length < 2) return [];
  const splits = [];
  let cumKm = 0;
  let lastSplitTs = path[0].ts;
  let lastSplitKm = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = haversineKm(path[i - 1], path[i]);
    cumKm += seg;
    while (cumKm - lastSplitKm >= 1) {
      // Linear interp: where between path[i-1] and path[i] did we cross the km mark?
      const overshoot = cumKm - lastSplitKm - 1;
      const fraction = 1 - (overshoot / seg);                       // 0..1
      const splitTs = path[i - 1].ts + (path[i].ts - path[i - 1].ts) * fraction;
      const timeSec = (splitTs - lastSplitTs) / 1000;
      const pace = timeSec / 60;                                    // min per km
      splits.push({
        km: splits.length + 1,
        timeSec: Math.round(timeSec),
        pace: Number(pace.toFixed(2)),
      });
      lastSplitTs = splitTs;
      lastSplitKm = lastSplitKm + 1;
    }
  }
  return splits;
}

/** Total elevation gain (sum of positive deltas) from a path's `alt` field. */
export function computeElevationGain(path) {
  if (!Array.isArray(path) || path.length < 2) return 0;
  let gain = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1].alt;
    const b = path[i].alt;
    if (typeof a === 'number' && typeof b === 'number') {
      const d = b - a;
      if (d > 0) gain += d;
    }
  }
  return Math.round(gain);
}

/**
 * Best (lowest) pace observed in a rolling 30-second window. Returns min per km
 * or null if not enough data.
 */
export function computeMaxPace(path) {
  if (!Array.isArray(path) || path.length < 3) return null;
  const WINDOW_MS = 30_000;
  let best = null;
  for (let i = 1; i < path.length; i++) {
    let j = i - 1;
    let dist = haversineKm(path[j], path[i]);
    while (j > 0 && path[i].ts - path[j].ts < WINDOW_MS) {
      j--;
      dist += haversineKm(path[j], path[j + 1]);
    }
    const dt = (path[i].ts - path[j].ts) / 60_000;
    if (dist > 0.05 && dt > 0) {
      const pace = dt / dist;
      if (best == null || pace < best) best = pace;
    }
  }
  return best != null ? Number(best.toFixed(2)) : null;
}
