import { supabase } from './supabase';
import { pickAvailableDefault } from './usernames';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

export function timeAgo(ts) {
  if (!ts) return '';
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Profile self-heal ─────────────────────────────────────────────────────────

/**
 * If the signed-in user's profile row has a missing/empty `name`, fill it from
 * auth metadata. This patches accounts created before the signup flow reliably
 * upserted into the profiles table — without it, the user shows up as
 * "AthloX User" everywhere their profile is joined into a query (posts,
 * comments, discover).
 *
 * Called on every successful login (App.js auth state change).
 */
export async function ensureProfileComplete(user) {
  if (!user?.id) return;
  const meta = user.user_metadata || {};
  const fallbackName = (meta.full_name || meta.name || user.email?.split('@')[0] || '').trim();
  if (!fallbackName) return;

  // Only touch the row if fields are currently blank — don't overwrite user edits.
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, name, username')
    .eq('id', user.id)
    .maybeSingle();

  if (!existing) {
    // No profile row at all — create one with everything we know
    const username = await pickAvailableDefault(user.email, user.id);
    // Note: do NOT include `email` here — the column doesn't exist on
    // `profiles`. Email lives in `auth.users` and is joined when needed.
    // Including it caused silent insert failures (Postgres rejects unknown
    // columns) which v1.2.1 worked around but never fixed at source.
    await supabase.from('profiles').upsert({
      id:       user.id,
      name:     fallbackName,
      level:    meta.level || null,
      username,
    });
    return;
  }

  const patch = {};
  if (!existing.name || existing.name.trim() === '') {
    patch.name = fallbackName;
  }
  // v1.2.0 backfill: every account needs a @username. Auto-generate from email
  // for any legacy account that doesn't have one yet.
  if (!existing.username) {
    const username = await pickAvailableDefault(user.email, user.id);
    if (username) patch.username = username;
  }
  if (Object.keys(patch).length > 0) {
    await supabase.from('profiles').update(patch).eq('id', user.id);
  }
}

// ── Posts ─────────────────────────────────────────────────────────────────────

export async function fetchPosts(myUserId) {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id, user_id, type, title, caption, workout_data, created_at,
      profiles:user_id (id, name, username, level),
      likes (user_id),
      comments (id)
    `)
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) throw error;

  return (data || []).map(p => ({
    id:           p.id,
    userId:       p.user_id,
    type:         p.type,
    title:        p.title,
    caption:      p.caption,
    workoutData:  p.workout_data || {},
    createdAt:    p.created_at,
    time:         timeAgo(p.created_at),
    profile:      p.profiles,
    likeCount:    p.likes?.length || 0,
    commentCount: p.comments?.length || 0,
    liked:        (p.likes || []).some(l => l.user_id === myUserId),
  }));
}

/**
 * Like fetchPosts, but only returns posts from users the current user follows.
 * Returns [] if the user follows nobody, so the UI can render an empty-state
 * prompt to discover and follow people.
 */
export async function fetchFollowingPosts(myUserId) {
  // Step 1 — who do I follow?
  const { data: follows, error: followsErr } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', myUserId);
  if (followsErr) throw followsErr;
  const followingIds = (follows || []).map(f => f.following_id);
  if (followingIds.length === 0) return [];

  // Step 2 — posts from those users, same shape as fetchPosts
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id, user_id, type, title, caption, workout_data, created_at,
      profiles:user_id (id, name, username, level),
      likes (user_id),
      comments (id)
    `)
    .in('user_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;

  return (data || []).map(p => ({
    id:           p.id,
    userId:       p.user_id,
    type:         p.type,
    title:        p.title,
    caption:      p.caption,
    workoutData:  p.workout_data || {},
    createdAt:    p.created_at,
    time:         timeAgo(p.created_at),
    profile:      p.profiles,
    likeCount:    p.likes?.length || 0,
    commentCount: p.comments?.length || 0,
    liked:        (p.likes || []).some(l => l.user_id === myUserId),
  }));
}

export async function shareWorkout({ userId, type, title, caption, workoutData }) {
  const { data, error } = await supabase
    .from('posts')
    .insert({ user_id: userId, type, title, caption, workout_data: workoutData })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Likes ─────────────────────────────────────────────────────────────────────

export async function toggleLike(postId, userId, currentlyLiked) {
  if (currentlyLiked) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('likes')
      .insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function fetchComments(postId) {
  const { data, error } = await supabase
    .from('comments')
    .select('id, body, created_at, profiles:user_id (id, name)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addComment(postId, userId, body) {
  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, user_id: userId, body })
    .select('id, body, created_at, profiles:user_id (id, name)')
    .single();
  if (error) throw error;
  return data;
}

// ── UGC Safety: Report + Block ───────────────────────────────────────────────
// Required by Google Play for any app with user-generated content. Without
// these the app can't be promoted past Internal Testing.

export const REPORT_REASONS = [
  { id: 'spam',          label: 'Spam or scam' },
  { id: 'harassment',    label: 'Harassment or hate speech' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'other',         label: 'Something else' },
];

/** Submit a report against a post. Silent no-op if the user has already
 *  reported the same post (the unique constraint on (post_id, reporter_id)
 *  catches duplicates). */
export async function reportPost(postId, reporterId, reason, details = null) {
  if (!postId || !reporterId || !reason) throw new Error('Missing fields');
  const { error } = await supabase
    .from('post_reports')
    .insert({ post_id: postId, reporter_id: reporterId, reason, details });
  // 23505 = unique violation → already reported. Treat as success.
  if (error && error.code !== '23505') throw error;
}

/** Block a user. Their posts disappear from feeds for the blocker. */
export async function blockUser(blockerId, blockedId) {
  if (!blockerId || !blockedId || blockerId === blockedId)
    throw new Error('Invalid block target');
  const { error } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error && error.code !== '23505') throw error;
  // Also remove any follow relationship in either direction (defensive)
  await supabase.from('follows').delete()
    .or(`and(follower_id.eq.${blockerId},following_id.eq.${blockedId}),and(follower_id.eq.${blockedId},following_id.eq.${blockerId})`);
}

/** Unblock a user. */
export async function unblockUser(blockerId, blockedId) {
  if (!blockerId || !blockedId) return;
  await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
}

/** Returns the set of user IDs the current user has blocked. */
export async function fetchBlockedIds(blockerId) {
  if (!blockerId) return new Set();
  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', blockerId);
  if (error) return new Set();
  return new Set((data || []).map(r => r.blocked_id));
}

// ── Follows ───────────────────────────────────────────────────────────────────

export async function toggleFollow(followerId, followingId, isCurrentlyFollowing) {
  if (isCurrentlyFollowing) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: followerId, following_id: followingId });
    if (error) throw error;
  }
}

// ── Discover ──────────────────────────────────────────────────────────────────

export async function fetchDiscoverUsers(myUserId) {
  const [usersRes, followingRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, username, level, streak, workouts')
      .neq('id', myUserId)
      .order('workouts', { ascending: false })
      .limit(40),
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', myUserId),
  ]);

  if (usersRes.error) throw usersRes.error;

  const followingIds = new Set((followingRes.data || []).map(f => f.following_id));

  return (usersRes.data || []).map(u => ({
    ...u,
    isFollowing: followingIds.has(u.id),
  }));
}

// ── User profile (for profile view) ──────────────────────────────────────────

export async function fetchUserProfile(userId, myUserId) {
  const [profileRes, followersRes, followingCountRes, postsRes, myFollowRes] = await Promise.all([
    supabase.from('profiles').select('id, name, username, level, streak, workouts').eq('id', userId).single(),
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
    supabase.from('posts').select('id, type, title, workout_data, created_at, likes(user_id)').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('follows').select('id').eq('follower_id', myUserId).eq('following_id', userId).maybeSingle(),
  ]);

  return {
    ...(profileRes.data || {}),
    followers:   followersRes.count || 0,
    following:   followingCountRes.count || 0,
    isFollowing: !!myFollowRes.data,
    posts:       (postsRes.data || []).map(p => ({
      ...p,
      likeCount: p.likes?.length || 0,
      time:      timeAgo(p.created_at),
    })),
  };
}
