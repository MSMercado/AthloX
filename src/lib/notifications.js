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

// Per-day plan reminder ids share this prefix so we can find + cancel them
// without tracking individual ids ourselves.
const PLAN_WORKOUT_PREFIX = 'athlox_plan_workout_';
const PLAN_REMINDER_HOUR   = 7;
const PLAN_REMINDER_MINUTE = 30;
// How many days ahead we schedule. iOS caps scheduled local notifications at
// 64 total — 7 days is well under that and PlanScreen reschedules on focus.
const PLAN_HORIZON_DAYS = 7;

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

// ── Per-day plan workout reminders (v1.4.0) ──────────────────────────────────
// Schedules a one-shot notification for the morning of each non-rest day in
// the user's active plan, over the next PLAN_HORIZON_DAYS. Re-callable
// (cancels prior plan notifs before re-scheduling) so PlanScreen can wire it
// to the plan + planCompletions state and re-run on focus.
//
// Each notification's body is the day's focus (e.g. "Push — chest,
// shoulders, triceps") so the user knows what they're showing up for
// without having to open the app.
export async function schedulePlanWorkoutReminders(plan, planCompletions = {}) {
  // Cancel any prior plan-day reminders by walking the scheduled list and
  // matching the prefix. Cheaper than tracking ids ourselves.
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      (scheduled || [])
        .filter(n => (n.identifier || '').startsWith(PLAN_WORKOUT_PREFIX))
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
    );
  } catch { /* silent — best-effort cancellation */ }

  if (!plan || !Array.isArray(plan.weeklySchedule) || plan.weeklySchedule.length === 0) return;

  const granted = await requestNotificationPermission();
  if (!granted) return;

  const today = new Date(); today.setHours(0, 0, 0, 0);

  for (let i = 0; i < PLAN_HORIZON_DAYS; i++) {
    const day = new Date(today); day.setDate(today.getDate() + i);
    // weeklySchedule is stored Mon-Sun. JS getDay() is Sun=0..Sat=6, so the
    // Mon-Sun index is (dow + 6) % 7.
    const dow = day.getDay();
    const idx = (dow + 6) % 7;
    const slot = plan.weeklySchedule[idx];
    if (!slot || slot.type === 'rest') continue;

    const yyyy = day.getFullYear();
    const mm   = String(day.getMonth() + 1).padStart(2, '0');
    const dd   = String(day.getDate()).padStart(2, '0');
    const dateKey = `${yyyy}-${mm}-${dd}`;
    if (planCompletions[dateKey]) continue; // already marked done

    const trigger = new Date(day);
    trigger.setHours(PLAN_REMINDER_HOUR, PLAN_REMINDER_MINUTE, 0, 0);
    if (trigger.getTime() <= Date.now()) continue; // past — skip

    const body = slot.focus || (slot.type === 'run' ? 'Run day' : 'Workout day');

    await Notifications.scheduleNotificationAsync({
      identifier: PLAN_WORKOUT_PREFIX + dateKey,
      content: {
        title: "Today's workout 💪",
        body,
        sound: true,
        data:  { screen: 'Plan' },
      },
      trigger: { date: trigger },
    }).catch(() => { /* skip this day if scheduling fails */ });
  }
}

// ── Cancel all AthloX notifications ──────────────────────────────────────────
export async function cancelAllNotifications() {
  await Promise.all(
    Object.values(NOTIF_IDS).map(id =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    )
  );
  // Also walk the scheduled list to catch the dynamic per-day plan reminders.
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      (scheduled || [])
        .filter(n => (n.identifier || '').startsWith(PLAN_WORKOUT_PREFIX))
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
    );
  } catch { /* silent */ }
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
