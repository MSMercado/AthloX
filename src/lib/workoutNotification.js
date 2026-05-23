// Live workout notification — shown in the status bar + on the lock screen
// while a GPS workout is active. Tester feedback (2026-05-23): users want to
// see time + distance updating on the lock screen so they don't have to
// unlock the phone mid-bike-ride.
//
// How it works:
//   1. Register a dedicated high-importance channel ("live-workout") the
//      first time we post — channel goes onto the lock screen as PUBLIC and
//      is treated as an ongoing activity by Android.
//   2. updateWorkoutNotification() re-posts a notification with the SAME
//      identifier each call. Android replaces the prior one in place, so the
//      user sees a live-updating widget rather than a stream of alerts.
//   3. clearWorkoutNotification() dismisses it when the workout ends.
//
// This sits ALONGSIDE expo-location's foreground-service notification
// (which is required for background GPS but whose text we can't update
// dynamically). The live notification is the prominent one; the foreground
// service one is a static "AthloX — tracking your bike ride" anchor.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const LIVE_WORKOUT_NOTIF_ID  = 'athlox-live-workout';
export const LIVE_WORKOUT_CHANNEL_ID = 'live-workout';

let channelEnsured = false;

async function ensureChannel() {
  if (channelEnsured || Platform.OS !== 'android') {
    channelEnsured = true;
    return;
  }
  try {
    await Notifications.setNotificationChannelAsync(LIVE_WORKOUT_CHANNEL_ID, {
      name:                  'Live workout tracking',
      description:           'Shows your current distance + time during a GPS workout.',
      importance:            Notifications.AndroidImportance.HIGH,
      lockscreenVisibility:  Notifications.AndroidNotificationVisibility.PUBLIC,
      // No sound / vibration — this is a passive live tile, not an alert.
      sound:                 null,
      vibrationPattern:      [0],
      enableVibrate:         false,
      showBadge:             false,
    });
  } catch (err) {
    console.warn('[workoutNotification] channel setup failed:', err?.message);
  }
  channelEnsured = true;
}

function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function fmtDist(km) {
  const k = Math.max(0, km || 0);
  return k < 1 ? `${Math.round(k * 1000)} m` : `${k.toFixed(2)} km`;
}

/**
 * Post or update the live workout notification. Safe to call every second
 * from the drain interval — Android coalesces re-posts with the same id
 * into an in-place update.
 *
 * @param {Object} params
 * @param {string} params.activityLabel - e.g. 'Bike', 'Run'
 * @param {number} params.elapsedSec    - seconds since the workout started
 * @param {number} params.distanceKm    - km covered so far
 */
export async function updateWorkoutNotification({ activityLabel, elapsedSec, distanceKm }) {
  await ensureChannel();
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: LIVE_WORKOUT_NOTIF_ID,
      content: {
        title:    `${activityLabel || 'Workout'} in progress`,
        body:     `${fmtTime(elapsedSec)} · ${fmtDist(distanceKm)}`,
        // Sticky / ongoing: user can't swipe it away while the workout is
        // active. Cleared by clearWorkoutNotification() at finish.
        sticky:   true,
        // No sound — this is a live tile, not a fresh alert.
        sound:    false,
        // Android-specific channel so the lock-screen visibility kicks in.
        ...(Platform.OS === 'android' ? { channelId: LIVE_WORKOUT_CHANNEL_ID } : {}),
      },
      trigger: null, // null = post immediately
    });
  } catch (err) {
    // Don't spam the console every second if posting fails (e.g. notification
    // permission denied). Just no-op.
  }
}

/**
 * Dismiss the live workout notification. Call when the workout ends
 * (gps-done) or when the user resets without finishing.
 */
export async function clearWorkoutNotification() {
  try {
    await Notifications.dismissNotificationAsync(LIVE_WORKOUT_NOTIF_ID);
  } catch (err) {
    // Already dismissed or never posted — fine.
  }
}
