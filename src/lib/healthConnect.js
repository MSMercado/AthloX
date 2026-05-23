// v2.0 — Android Health Connect wrapper for heart-rate + cadence samples.
//
// IMPORTANT: this file ships as JS today but the integration needs the
// `react-native-health-connect` native module + Health Connect data-type
// permissions in AndroidManifest. Both come from a fresh EAS dev build:
//
//   1. yarn / npm add: react-native-health-connect
//   2. app.json plugins: add ["react-native-health-connect"] entry
//      (alongside expo-location, expo-notifications etc.)
//   3. eas build --profile development --platform android
//   4. Install the new APK on the test device.
//
// Until step 3-4 are done, every function here will throw and the wrapper
// will return null. RunSummary handles that — HR/cadence rows simply
// don't render when the data is absent.
//
// We lazy-require so the JS-only dev build doesn't blow up at import time.
// If the package isn't installed yet, hcRef stays null and all functions
// short-circuit.

import { Platform } from 'react-native';

let hcRef = null;
let initTried = false;

function loadModule() {
  if (initTried) return hcRef;
  initTried = true;
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line global-require
    hcRef = require('react-native-health-connect');
  } catch {
    // Not installed yet (JS-only dev build). Caller will get null.
  }
  return hcRef;
}

/** True if Health Connect is available + permissions can be requested. */
export async function isAvailable() {
  const hc = loadModule();
  if (!hc) return false;
  try {
    const status = await hc.getSdkStatus();
    return status === hc.SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

/**
 * Ask the user for HEART_RATE + EXERCISE permissions (or whichever record
 * types we want). Returns true if granted, false otherwise. Caller should
 * cache the result so we don't re-prompt every run.
 */
export async function requestPermissions() {
  const hc = loadModule();
  if (!hc) return false;
  try {
    await hc.initialize();
    const granted = await hc.requestPermission([
      { accessType: 'read', recordType: 'HeartRate' },
      { accessType: 'read', recordType: 'StepsCadence' },
    ]);
    // SDK returns the array of permissions actually granted
    return Array.isArray(granted) && granted.length >= 1;
  } catch {
    return false;
  }
}

/**
 * Read heart-rate samples for a time window. Returns { avg, max } in BPM
 * or null if no samples / Health Connect unavailable.
 */
export async function readHeartRate(startIso, endIso) {
  const hc = loadModule();
  if (!hc) return null;
  try {
    await hc.initialize();
    const result = await hc.readRecords('HeartRate', {
      timeRangeFilter: { operator: 'between', startTime: startIso, endTime: endIso },
    });
    const records = result?.records || result || [];
    const bpms = [];
    for (const r of records) {
      // Each HeartRate record has a `samples` array with {beatsPerMinute, time}.
      const samples = r?.samples || (r?.beatsPerMinute != null ? [r] : []);
      for (const s of samples) {
        if (s?.beatsPerMinute) bpms.push(s.beatsPerMinute);
      }
    }
    if (bpms.length === 0) return null;
    const avg = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
    const max = Math.max(...bpms);
    return { avg, max };
  } catch {
    return null;
  }
}

/**
 * Read steps-cadence samples for a time window. Returns the avg cadence
 * (steps/min) or null.
 */
export async function readCadence(startIso, endIso) {
  const hc = loadModule();
  if (!hc) return null;
  try {
    await hc.initialize();
    const result = await hc.readRecords('StepsCadence', {
      timeRangeFilter: { operator: 'between', startTime: startIso, endTime: endIso },
    });
    const records = result?.records || result || [];
    const rates = [];
    for (const r of records) {
      const samples = r?.samples || (r?.rate != null ? [r] : []);
      for (const s of samples) {
        if (s?.rate) rates.push(s.rate);
      }
    }
    if (rates.length === 0) return null;
    return Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
  } catch {
    return null;
  }
}

/**
 * Convenience: read both HR + cadence for a run window, return the patch
 * shape expected by updateRunActivity. Returns null if neither data type
 * yielded any samples.
 */
export async function readRunMetrics(startIso, endIso) {
  const [hr, cadence] = await Promise.all([
    readHeartRate(startIso, endIso),
    readCadence(startIso, endIso),
  ]);
  if (!hr && cadence == null) return null;
  const patch = {};
  if (hr?.avg != null) patch.avgHrBpm = hr.avg;
  if (hr?.max != null) patch.maxHrBpm = hr.max;
  if (cadence != null) patch.avgCadence = cadence;
  return patch;
}
