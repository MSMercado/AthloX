/**
 * AthloX Notification Service
 * Handles scheduling and cancelling of local push notifications.
 * No server needed — all notifications are local/scheduled on-device.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ── Configure how notifications appear when the app is foregrounded ───────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

// ── Notification IDs (used to cancel specific ones) ───────────────────────────
export const NOTIF_IDS = {
  WORKOUT_REMINDER:  'athlox_workout_reminder',
  STREAK_REMINDER:   'athlox_streak_reminder',
  COACH_TIP:         'athlox_coach_tip',
};

// ── Request Permission ────────────────────────────────────────────────────────
export async function requestNotificationPermission() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Schedule: Daily workout reminder (fires every day at 8:00 AM) ─────────────
export async function scheduleWorkoutReminder(enabled = true) {
  // Always cancel first so we don't double-schedule
  await Notifications.cancelScheduledNotificationAsync(NOTIF_IDS.WORKOUT_REMINDER).catch(() => {});

  if (!enabled) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIF_IDS.WORKOUT_REMINDER,
    content: {
      title: "Time to train 💪",
      body:  "Check your plan for today's workout — consistency is everything!",
      sound: true,
      data:  { screen: 'Plan' },
    },
    trigger: {
      hour:    8,
      minute:  0,
      repeats: true,
    },
  });
}

// ── Schedule: Daily streak protection reminder (fires every day at 7:30 PM) ───
export async function scheduleStreakReminder(enabled = true) {
  await Notifications.cancelScheduledNotificationAsync(NOTIF_IDS.STREAK_REMINDER).catch(() => {});

  if (!enabled) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIF_IDS.STREAK_REMINDER,
    content: {
      title: "Don't break your streak! 🔥",
      body:  "Log a workout before midnight to keep your streak going.",
      sound: true,
      data:  { screen: 'Track' },
    },
    trigger: {
      hour:    19,
      minute:  30,
      repeats: true,
    },
  });
}

// ── Schedule: Weekly coach tip (fires every Monday at 9:00 AM) ────────────────
export async function scheduleCoachTip(enabled = true) {
  await Notifications.cancelScheduledNotificationAsync(NOTIF_IDS.COACH_TIP).catch(() => {});

  if (!enabled) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    identifier: NOTIF_IDS.COACH_TIP,
    content: {
      title: "New week, new gains ✨",
      body:  "Your AI Coach has tips to help you crush this week. Tap to chat!",
      sound: true,
      data:  { screen: 'Coach' },
    },
    trigger: {
      weekday: 2,   // Monday (1=Sun, 2=Mon ... 7=Sat in Expo)
      hour:    9,
      minute:  0,
      repeats: true,
    },
  });
}

// ── Cancel all AthloX notifications ──────────────────────────────────────────
export async function cancelAllNotifications() {
  await Promise.all(
    Object.values(NOTIF_IDS).map(id =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    )
  );
}

// ── Apply all notification settings at once ───────────────────────────────────
// Call this whenever a toggle changes in Settings
export async function applyNotificationSettings({ workout, streak, coach }) {
  await scheduleWorkoutReminder(workout);
  await scheduleStreakReminder(streak);
  await scheduleCoachTip(coach);
}

// ── Set up navigation on notification tap ────────────────────────────────────
// Returns cleanup function — call inside useEffect in App.js
export function setupNotificationTapHandler(navigationRef) {
  const sub = Notifications.addNotificationResponseReceivedListener(response => {
    const screen = response.notification.request.content.data?.screen;
    if (screen && navigationRef?.current) {
      navigationRef.current.navigate(screen);
    }
  });
  return () => sub.remove();
}
