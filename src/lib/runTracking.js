// Background-aware GPS run tracking for AthloX.
//
// Why this exists: v1.1.0 used `Location.watchPositionAsync` which dies the
// moment the phone locks or the app goes to background. v1.2.0 replaces it
// with `Location.startLocationUpdatesAsync` + a TaskManager task that runs
// inside an Android foreground service, so the OS keeps our JS context alive
// even when the screen is off.
//
// Architecture: TaskManager.defineTask runs outside React. It can't `setState`
// directly. So we keep a module-level `tracking` buffer; the task pushes new
// points into it; the foreground TrackScreen polls the buffer with a setInterval
// (or AppState 'active' transition) and pulls updates into React state.
//
// On Expo: `expo-location` and `expo-task-manager` are required and DO NOT
// work in Expo Go — Julie needs a development build (or production AAB) for
// testing. Plain `npx expo start` against Expo Go will throw.

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

export const RUN_TRACKING_TASK = 'athlox-run-tracking';

// Module-level state. Survives backgrounding because expo-location's
// foreground service keeps the JS runtime alive. Reset on each new run.
const tracking = {
  active: false,
  paused: false,
  points: [],          // [{ lat, lng, alt, ts, accuracy }]
  startedAt: 0,
};

// Tunable noise filters. Three layers stack to clean up raw GPS:
//   1. ACCURACY_FLOOR_M  — drop fixes whose self-reported accuracy is worse
//      than this. Strava/Runna typically use 20-25m. Lower = cleaner route,
//      fewer points to work with in poor conditions.
//   2. WARMUP_MS         — discard the first N milliseconds after tracking
//      starts. The GPS chip is still acquiring satellites and even "good"
//      fixes during this window are unreliable.
//   3. MAX_SPEED_MPS     — reject any fix whose implied speed (vs the previous
//      kept fix) exceeds this. Catches urban-canyon teleport spikes. 12 m/s
//      is ~43 km/h — comfortably above world-class sprint pace, well below
//      anything cars/cycles/etc could produce by accident.
const ACCURACY_FLOOR_M = 20;
const WARMUP_MS        = 3000;
const MAX_SPEED_MPS    = 12;

// Quick haversine for the speed-filter check below. Returns metres.
function haversineM(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Define the background task once at module load. This is required even if we
// only start tracking later — TaskManager registers tasks at JS init time.
TaskManager.defineTask(RUN_TRACKING_TASK, ({ data, error }) => {
  if (error) {
    console.warn('[runTracking] task error:', error?.message);
    return;
  }
  if (!tracking.active || tracking.paused) return;
  const locations = data?.locations;
  if (!Array.isArray(locations) || locations.length === 0) return;

  for (const loc of locations) {
    const acc = loc?.coords?.accuracy;
    const ts  = loc.timestamp || Date.now();

    // Filter 1 — accuracy floor. Drops cellular-only / weak sky view fixes.
    if (typeof acc === 'number' && acc > ACCURACY_FLOOR_M) continue;

    // Filter 2 — warmup window. Drops the first few seconds while the GPS
    // chip is still acquiring satellites; even "good" fixes here drift.
    if (ts - tracking.startedAt < WARMUP_MS) continue;

    const candidate = {
      lat:      loc.coords.latitude,
      lng:      loc.coords.longitude,
      alt:      typeof loc.coords.altitude === 'number' ? loc.coords.altitude : null,
      ts,
      accuracy: typeof acc === 'number' ? acc : null,
    };

    // Filter 3 — max-speed gate. If the implied speed vs the last kept point
    // exceeds MAX_SPEED_MPS, this is almost certainly a GPS teleport, not real
    // motion. Drop it. (Skip on the first kept point, which has nothing to
    // compare against.)
    const last = tracking.points[tracking.points.length - 1];
    if (last) {
      const distM = haversineM(last, candidate);
      const dt    = (candidate.ts - last.ts) / 1000;
      if (dt > 0 && (distM / dt) > MAX_SPEED_MPS) continue;
    }

    tracking.points.push(candidate);
  }
});

/**
 * Request both foreground AND background location permissions, then start the
 * foreground service. Throws on permission denial — caller (TrackScreen) maps
 * the error message to the existing permission-denied UI.
 */
export async function startRunTracking() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    throw new Error('PERMISSION_FOREGROUND_DENIED');
  }
  // Background permission is a separate Android prompt that the OS only allows
  // *after* foreground was granted. On Android 11+ users typically have to
  // pick "Allow all the time" manually in Settings — Expo will deep-link them.
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') {
    throw new Error('PERMISSION_BACKGROUND_DENIED');
  }

  // Reset buffer for this run
  tracking.active = true;
  tracking.paused = false;
  tracking.points = [];
  tracking.startedAt = Date.now();

  // Defensive: if a previous task is somehow still registered, kill it first
  if (await Location.hasStartedLocationUpdatesAsync(RUN_TRACKING_TASK)) {
    await Location.stopLocationUpdatesAsync(RUN_TRACKING_TASK);
  }

  await Location.startLocationUpdatesAsync(RUN_TRACKING_TASK, {
    accuracy:         Location.Accuracy.BestForNavigation,
    timeInterval:     1000,    // request fix every 1s
    distanceInterval: 2,       // ...or every 2 metres of movement
    pausesUpdatesAutomatically: false, // keep going even if user stops moving
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle:   'AthloX — tracking your run',
      notificationBody:    'Distance, pace, and time are being recorded. Tap to return.',
      notificationColor:   '#FF6B00',
    },
    activityType: Location.ActivityType.Fitness,
  });
}

/** Pause tracking — points stop accumulating but the foreground service stays
 *  up so resuming is instant. Mirrors the existing in-app "Pause" button. */
export function pauseRunTracking()  { tracking.paused = true; }
export function resumeRunTracking() { tracking.paused = false; }

/**
 * Stop the foreground service and tear down the task. Returns the captured
 * points so the caller can build the run activity object before they're
 * cleared.
 */
export async function stopRunTracking() {
  tracking.active = false;
  tracking.paused = false;
  const finalPoints = [...tracking.points];
  if (await Location.hasStartedLocationUpdatesAsync(RUN_TRACKING_TASK)) {
    await Location.stopLocationUpdatesAsync(RUN_TRACKING_TASK);
  }
  return finalPoints;
}

/** Read-only accessor for TrackScreen's UI polling loop. */
export function getTrackingState() {
  return {
    active:  tracking.active,
    paused:  tracking.paused,
    points:  tracking.points,
    startedAt: tracking.startedAt,
  };
}

/** Discard everything — used by TrackScreen.reset() so the next run starts clean. */
export async function resetRunTracking() {
  if (tracking.active) await stopRunTracking();
  tracking.points = [];
  tracking.startedAt = 0;
}
