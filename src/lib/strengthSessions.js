// v2.0 — Supabase wrapper for strength_sessions + strength_session_exercises.
// Mirrors the shape of runActivities.js so call sites feel consistent.
//
// JS shape (camelCase):
//   StrengthSession = {
//     id, userId, logId, startedAt, durationSec, calories, routineName, notes,
//     exercises: [{ id, ordinal, name, sets: [{reps, weight}], notes }],
//     createdAt,
//   }

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const SESSIONS_TABLE = 'strength_sessions';
const EXERCISES_TABLE = 'strength_session_exercises';
const PENDING_KEY = 'wb_pendingStrength';

// ── Row conversions ─────────────────────────────────────────────────────────

function sessionFromRow(row, exerciseRows = []) {
  if (!row) return null;
  return {
    id:           row.id,
    userId:       row.user_id,
    logId:        row.log_id,
    startedAt:    row.started_at,
    durationSec:  row.duration_sec,
    calories:     row.calories,
    routineName:  row.routine_name,
    notes:        row.notes,
    createdAt:    row.created_at,
    exercises:    (exerciseRows || []).map(exerciseFromRow),
  };
}

function exerciseFromRow(row) {
  return {
    id:       row.id,
    ordinal:  row.ordinal,
    name:     row.exercise_name,
    sets:     Array.isArray(row.sets) ? row.sets : [],
    notes:    row.notes,
  };
}

// ── Save ────────────────────────────────────────────────────────────────────

/**
 * Persist a session + its exercises. Two inserts (session row, then a batch
 * insert of exercises with the new session id). Returns the saved shape so
 * the caller can stitch the id back onto its local log entry.
 *
 * @param {Object} session    e.g. { logId, startedAt, durationSec, calories, routineName }
 * @param {Array}  exercises  [{ ordinal, name, sets }]
 */
export async function saveStrengthSession(session, exercises) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { data: sessionRow, error: sErr } = await supabase
    .from(SESSIONS_TABLE)
    .insert({
      user_id:      userId,
      log_id:       session.logId != null ? String(session.logId) : null,
      started_at:   session.startedAt,
      duration_sec: Math.round(session.durationSec || 0),
      calories:     session.calories != null ? Math.round(session.calories) : null,
      routine_name: session.routineName || null,
      notes:        session.notes || null,
    })
    .select()
    .single();
  if (sErr) throw sErr;

  let exerciseRows = [];
  if (Array.isArray(exercises) && exercises.length > 0) {
    const rows = exercises.map((ex, i) => ({
      session_id:    sessionRow.id,
      ordinal:       ex.ordinal != null ? ex.ordinal : i,
      exercise_name: ex.name || 'Exercise',
      sets:          Array.isArray(ex.sets) ? ex.sets : [],
      notes:         ex.notes || null,
    }));
    const { data: exRows, error: eErr } = await supabase
      .from(EXERCISES_TABLE)
      .insert(rows)
      .select();
    if (eErr) throw eErr;
    exerciseRows = exRows || [];
  }

  return sessionFromRow(sessionRow, exerciseRows);
}

// ── Read ────────────────────────────────────────────────────────────────────

export async function listStrengthSessions({ limit = 100 } = {}) {
  const { data, error } = await supabase
    .from(SESSIONS_TABLE)
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(row => sessionFromRow(row, []));
}

export async function getStrengthSession(id) {
  const { data: sessionRow, error: sErr } = await supabase
    .from(SESSIONS_TABLE).select('*').eq('id', id).single();
  if (sErr) throw sErr;
  const { data: exRows, error: eErr } = await supabase
    .from(EXERCISES_TABLE)
    .select('*').eq('session_id', id).order('ordinal', { ascending: true });
  if (eErr) throw eErr;
  return sessionFromRow(sessionRow, exRows);
}

// ── Update / delete ─────────────────────────────────────────────────────────

export async function updateStrengthSession(id, patch) {
  const row = {};
  if (patch.notes != null)      row.notes        = patch.notes;
  if (patch.routineName != null)row.routine_name = patch.routineName;
  if (patch.calories != null)   row.calories     = Math.round(patch.calories);
  const { data, error } = await supabase
    .from(SESSIONS_TABLE).update(row).eq('id', id).select().single();
  if (error) throw error;
  // Re-fetch exercises (cheap, single query)
  const { data: exRows } = await supabase
    .from(EXERCISES_TABLE).select('*').eq('session_id', id).order('ordinal', { ascending: true });
  return sessionFromRow(data, exRows);
}

export async function deleteStrengthSession(id) {
  // ON DELETE CASCADE drops the exercises automatically.
  const { error } = await supabase.from(SESSIONS_TABLE).delete().eq('id', id);
  if (error) throw error;
}

// ── Offline queue (parallel to runActivities) ───────────────────────────────

export async function enqueuePendingStrength(payload) {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push({ ...payload, queuedAt: Date.now() });
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(arr));
  } catch { /* silent */ }
}

export async function drainPendingStrength() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (arr.length === 0) return [];
    const saved = [];
    const remaining = [];
    for (const item of arr) {
      try {
        const s = await saveStrengthSession(item.session, item.exercises);
        saved.push(s);
      } catch {
        remaining.push(item);
      }
    }
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
    return saved;
  } catch {
    return [];
  }
}
