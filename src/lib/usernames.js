// Helpers for the @username system.
//
// Rules (matched server-side by a CHECK constraint on profiles.username):
//   - 3 to 20 characters
//   - lowercase letters, digits, and underscores only
//   - unique across all users

import { supabase } from './supabase';

export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
export const MIN_LEN = 3;
export const MAX_LEN = 20;

/**
 * Validate a username string. Returns null if valid, or an error message
 * suitable for displaying inline under an input field.
 */
export function validateUsername(input) {
  if (!input)                       return 'Username is required';
  if (input.length < MIN_LEN)       return `Must be at least ${MIN_LEN} characters`;
  if (input.length > MAX_LEN)       return `Must be at most ${MAX_LEN} characters`;
  if (input !== input.toLowerCase())return 'Must be all lowercase';
  if (!USERNAME_REGEX.test(input))  return 'Only letters, numbers, and underscores';
  return null;
}

/**
 * Strip + lowercase + replace invalid chars so a user's keystrokes can never
 * land on an obviously-bad value. Useful for onChangeText.
 */
export function sanitiseUsernameInput(input) {
  if (!input) return '';
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')   // drop spaces, punctuation, etc.
    .slice(0, MAX_LEN);
}

/**
 * Generate a default username from an email address. Used to auto-fill the
 * onboarding step + to backfill existing users via ensureProfileComplete.
 *
 * Example: "julie.runs+test@gmail.com" → "julieruns"
 *
 * If the derived stem is too short or collides, the caller appends a numeric
 * suffix (this function doesn't loop — that's the caller's responsibility,
 * since they have the Supabase client).
 */
export function defaultUsernameFromName(name) {
  if (!name) return null;
  const stem = String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9_]/g, '');
  if (stem.length < MIN_LEN) return null;
  return stem.slice(0, MAX_LEN);
}

/**
 * @deprecated Don't use for anything public. A username derived from the
 * email prefix lets anyone on Community guess the user's email address.
 * Kept only so older imports don't break; use defaultUsernameFromName.
 */
export function defaultUsernameFromEmail(email) {
  if (!email) return null;
  const stem = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  if (stem.length < MIN_LEN) return null;       // caller will fall back further
  return stem.slice(0, MAX_LEN);
}

/**
 * Check whether a username is available. Returns:
 *   { available: true }                            — free to claim
 *   { available: false, reason: '...' }            — taken or invalid
 */
export async function checkUsernameAvailable(username, currentUserId = null) {
  const err = validateUsername(username);
  if (err) return { available: false, reason: err };

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (error)            return { available: false, reason: 'Could not check — try again' };
  if (!data)            return { available: true };
  if (data.id === currentUserId) return { available: true }; // user already owns this
  return { available: false, reason: 'Already taken' };
}

/**
 * Try to claim a username for the given user. Returns:
 *   { ok: true,  username }       — success
 *   { ok: false, error: '...' }   — taken or validation failure
 */
export async function setUsername(userId, username) {
  if (!userId) return { ok: false, error: 'Not signed in' };
  const err = validateUsername(username);
  if (err)     return { ok: false, error: err };

  const { error } = await supabase
    .from('profiles')
    .update({ username })
    .eq('id', userId);

  if (error) {
    // 23505 = unique constraint violation. Anything else is a generic save error.
    if (error.code === '23505') return { ok: false, error: 'Already taken' };
    return { ok: false, error: error.message || 'Could not save username' };
  }
  return { ok: true, username };
}

/**
 * Pick an available default username for a brand-new user, suffixing with
 * digits if the stem is already taken. Capped at 5 attempts; caller should
 * handle null by falling back to whatever onboarding flow they prefer.
 */
export async function pickAvailableDefault(displayName, userId) {
  // Built from the user's display name, never their email: usernames are
  // public on Community, and an email-prefix username gives away the email.
  const nameStem = defaultUsernameFromName(displayName);
  const stem = nameStem || 'athlete';

  // First try the bare stem (only when it came from their name — a bare
  // "athlete" is never going to be free and isn't meaningful anyway)
  if (nameStem) {
    const first = await checkUsernameAvailable(stem, userId);
    if (first.available) return stem;
  }

  // Then stem + 2/3/4-digit numeric suffix
  for (let i = 0; i < 5; i++) {
    const suffix = Math.floor(Math.random() * 9000 + 100); // 100-9099
    const candidate = `${stem.slice(0, MAX_LEN - String(suffix).length)}${suffix}`;
    const check = await checkUsernameAvailable(candidate, userId);
    if (check.available) return candidate;
  }
  return null;
}
