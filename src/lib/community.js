import { supabase } from './supabase';

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

// ── Posts ─────────────────────────────────────────────────────────────────────

export async function fetchPosts(myUserId) {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id, user_id, type, title, caption, workout_data, created_at,
      profiles:user_id (id, name, level),
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
      .select('id, name, level, streak, workouts')
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
    supabase.from('profiles').select('id, name, level, streak, workouts').eq('id', userId).single(),
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
