import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { didLevelUp, getLevelInfo } from '../lib/xp';

const useStore = create((set, get) => ({
  // ── Auth ──
  user: null,
  session: null,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),

  // ── Dark mode ──
  darkMode: false,
  toggleDarkMode: async () => {
    const next = !get().darkMode;
    set({ darkMode: next });
    AsyncStorage.setItem('wb_darkMode', JSON.stringify(next)).catch(e => console.warn('[useStore] storage error:', e?.message));
  },

  // ── Workout logs ──
  logs: [],
  setLogs: (logs) => set({ logs }),
  addLog: (log) => {
    const logs = [log, ...get().logs];
    set({ logs });
    AsyncStorage.setItem('wb_logs', JSON.stringify(logs)).catch(e => console.warn('[useStore] storage error:', e?.message));
  },

  // ── Routines ──
  routines: [],
  setRoutines: (routines) => set({ routines }),
  addRoutine: (routine) => {
    const routines = [routine, ...get().routines];
    set({ routines });
    AsyncStorage.setItem('wb_routines', JSON.stringify(routines)).catch(e => console.warn('[useStore] storage error:', e?.message));
  },

  // ── Workout Plan ──
  workoutPlan: null,
  setWorkoutPlan: (plan) => {
    set({ workoutPlan: plan });
    AsyncStorage.setItem('wb_workoutPlan', JSON.stringify(plan)).catch(e => console.warn('[useStore] storage error:', e?.message));
  },

  // ── Scheduled Workouts (from AI Coach) ──
  scheduledWorkouts: [],
  setScheduledWorkouts: (scheduledWorkouts) => {
    set({ scheduledWorkouts });
    AsyncStorage.setItem('wb_scheduledWorkouts', JSON.stringify(scheduledWorkouts)).catch(e => console.warn('[useStore] storage error:', e?.message));
  },

  // ── Notification settings ──
  notifSettings: { workout: true, streak: true, coach: false },
  setNotifSettings: (settings) => {
    set({ notifSettings: settings });
    AsyncStorage.setItem('wb_notifSettings', JSON.stringify(settings)).catch(e => console.warn('[useStore] storage error:', e?.message));
  },

  // ── XP & Gamification ──
  xp: 0,
  xpEvent: null, // { amount, oldXP, newXP, leveledUp, newLevelInfo } — triggers popup
  addXP: (amount) => {
    const oldXP   = get().xp;
    const newXP   = oldXP + amount;
    const leveled = didLevelUp(oldXP, newXP);
    const newLevelInfo = getLevelInfo(newXP);
    set({
      xp: newXP,
      xpEvent: { amount, oldXP, newXP, leveledUp: leveled, newLevelInfo },
    });
    AsyncStorage.setItem('wb_xp', JSON.stringify(newXP)).catch(e => console.warn('[useStore] storage error:', e?.message));
  },
  clearXPEvent: () => set({ xpEvent: null }),

  // ── Hydrate from storage ──
  hydrate: async () => {
    try {
      const [logs, routines, darkMode, workoutPlan, scheduledWorkouts, notifSettings, xp] = await Promise.all([
        AsyncStorage.getItem('wb_logs'),
        AsyncStorage.getItem('wb_routines'),
        AsyncStorage.getItem('wb_darkMode'),
        AsyncStorage.getItem('wb_workoutPlan'),
        AsyncStorage.getItem('wb_scheduledWorkouts'),
        AsyncStorage.getItem('wb_notifSettings'),
        AsyncStorage.getItem('wb_xp'),
      ]);
      set({
        logs:               logs               ? JSON.parse(logs)               : [],
        routines:           routines           ? JSON.parse(routines)           : [],
        darkMode:           darkMode           ? JSON.parse(darkMode)           : false,
        workoutPlan:        workoutPlan        ? JSON.parse(workoutPlan)        : null,
        scheduledWorkouts:  scheduledWorkouts  ? JSON.parse(scheduledWorkouts)  : [],
        notifSettings:      notifSettings      ? JSON.parse(notifSettings)      : { workout: true, streak: true, coach: false },
        xp:                 xp                 ? JSON.parse(xp)                 : 0,
      });
    } catch (e) {
      console.warn('[useStore] hydrate failed:', e?.message);
    }
  },
}));

export default useStore;
