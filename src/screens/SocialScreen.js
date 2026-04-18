import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, RefreshControl, ActivityIndicator, BackHandler,
  Modal, Image, Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import useColors from '../lib/useColors';
import { shadow } from '../lib/theme';
import HeaderActions from '../components/HeaderActions';
import { supabase } from '../lib/supabase';
import {
  fetchPosts, toggleLike, fetchComments, addComment as addCommentDB,
  fetchDiscoverUsers, toggleFollow as toggleFollowDB,
  fetchUserProfile, getInitials, timeAgo, shareWorkout,
} from '../lib/community';

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name, size = 40 }) {
  const colors = useColors();
  const initials = getInitials(name);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontWeight: '700', color: colors.text2, fontSize: size * 0.35 }}>{initials}</Text>
    </View>
  );
}

// ── UserProfile ───────────────────────────────────────────────────────────────

function UserProfile({ userId, myUserId, onBack }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [profile, setProfile]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [isFollowing, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    fetchUserProfile(userId, myUserId)
      .then(p => { setProfile(p); setFollowing(p.isFollowing); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  const handleFollow = async () => {
    if (!myUserId || followLoading) return;
    setFollowLoading(true);
    const was = isFollowing;
    setFollowing(!was);
    try {
      await toggleFollowDB(myUserId, userId, was);
      setProfile(p => ({ ...p, followers: p.followers + (was ? -1 : 1) }));
    } catch {
      setFollowing(was);
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!profile) return null;

  return (
    <View style={styles.container}>
      <View style={styles.profileHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Community</Text>
        </TouchableOpacity>
        <View style={styles.profileTop}>
          <Avatar name={profile.name} size={60} />
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{profile.name}</Text>
            {profile.level ? (
              <View style={styles.levelBadge}><Text style={styles.levelText}>{profile.level}</Text></View>
            ) : null}
            {profile.streak > 0 && (
              <Text style={styles.profileBio}>🔥 {profile.streak} day streak</Text>
            )}
          </View>
        </View>
        <View style={styles.profileStats}>
          {[[profile.workouts || 0, 'Workouts'], [profile.followers, 'Followers'], [profile.following, 'Following']].map(([v, l]) => (
            <View key={l} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.profileStatVal}>{v}</Text>
              <Text style={styles.profileStatLabel}>{l}</Text>
            </View>
          ))}
        </View>
        {myUserId !== userId && (
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followBtnActive]}
            onPress={handleFollow}
            activeOpacity={0.85}
            disabled={followLoading}
          >
            <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
              {isFollowing ? 'Following ✓' : '+ Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {profile.posts.length === 0 ? (
          <Text style={{ color: colors.text3, textAlign: 'center', marginTop: 24 }}>No posts yet</Text>
        ) : profile.posts.map(p => (
          <View key={p.id} style={[styles.card, { padding: 14, marginBottom: 10 }]}>
            <Text style={styles.postTitle}>{p.title}</Text>
            <Text style={styles.postMeta}>
              {p.workout_data?.duration ? `${p.workout_data.duration}min` : ''}
              {p.workout_data?.calories ? ` · ${p.workout_data.calories} cal` : ''}
              {p.workout_data?.distance ? ` · ${p.workout_data.distance}km` : ''}
            </Text>
            <Text style={{ fontSize: 12, color: colors.text3, marginTop: 6 }}>❤️ {p.likeCount} · {p.time}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ── PostCard ──────────────────────────────────────────────────────────────────

function PostCard({ post, myUserId, myName, onLike, onViewUser, onFollow, followingIds }) {
  const colors  = useColors();
  const styles  = useMemo(() => makeStyles(colors), [colors]);
  const inputRef = useRef(null);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments]         = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText]   = useState('');
  const [sending, setSending]           = useState(false);

  const isFollowing = followingIds.has(post.userId);
  const isMine = post.userId === myUserId;

  const openComments = async () => {
    const opening = !showComments;
    setShowComments(opening);
    if (opening && comments.length === 0) {
      setCommentsLoading(true);
      try {
        const data = await fetchComments(post.id);
        setComments(data);
      } catch { /* silent */ }
      setCommentsLoading(false);
    }
  };

  const handleAddComment = async () => {
    const t = commentText.trim();
    if (!t || !myUserId || sending) return;
    setSending(true);
    setCommentText('');
    inputRef.current?.blur();
    try {
      const newComment = await addCommentDB(post.id, myUserId, t);
      setComments(prev => [...prev, newComment]);
      onLike(post.id, 'commentCountUp'); // re-use to bump comment count display
    } catch { /* silent */ }
    setSending(false);
  };

  const wd = post.workoutData || {};

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.postHeader}>
        <TouchableOpacity onPress={() => onViewUser(post.userId)} activeOpacity={0.8}>
          <Avatar name={post.profile?.name} size={40} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <TouchableOpacity onPress={() => onViewUser(post.userId)}>
            <Text style={styles.posterName}>{post.profile?.name || 'AthloX User'}</Text>
          </TouchableOpacity>
          <Text style={styles.posterMeta}>{post.time}</Text>
        </View>
        {!isMine && !isFollowing && (
          <TouchableOpacity style={styles.smallFollowBtn} onPress={() => onFollow(post.userId)} activeOpacity={0.85}>
            <Text style={styles.smallFollowText}>+ Follow</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Caption */}
      {!!post.caption && <Text style={styles.caption}>{post.caption}</Text>}

      {/* Post image */}
      {!!post.workoutData?.image_url && (
        <Image
          source={{ uri: post.workoutData.image_url }}
          style={styles.postImage}
          resizeMode="cover"
        />
      )}

      {/* Stats block */}
      <View style={styles.postStats}>
        <Text style={styles.postTitle}>{post.title}</Text>
        <View style={{ flexDirection: 'row', gap: 18, marginTop: 8 }}>
          {wd.distance > 0 && (
            <View>
              <Text style={styles.statVal}>{wd.distance}km</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
          )}
          {wd.duration > 0 && (
            <View>
              <Text style={styles.statVal}>{wd.duration}m</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
          )}
          {wd.calories > 0 && (
            <View>
              <Text style={styles.statVal}>{wd.calories}</Text>
              <Text style={styles.statLabel}>Cal</Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onLike(post.id)} activeOpacity={0.8}>
          <Text style={styles.actionIcon}>{post.liked ? '❤️' : '🤍'}</Text>
          <Text style={[styles.actionText, post.liked && { color: colors.red }]}>{post.likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={openComments} activeOpacity={0.8}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionText}>{post.commentCount}</Text>
        </TouchableOpacity>
      </View>

      {/* Comments */}
      {showComments && (
        <View style={styles.commentsSection}>
          {commentsLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 8 }} />
          ) : (
            comments.map(c => (
              <View key={c.id} style={styles.commentRow}>
                <Avatar name={c.profiles?.name || '?'} size={30} />
                <View style={styles.commentBubble}>
                  <Text style={styles.commentName}>{c.profiles?.name || 'User'}</Text>
                  <Text style={styles.commentText}>{c.body}</Text>
                </View>
              </View>
            ))
          )}
          {myUserId && (
            <View style={styles.commentInput}>
              <TextInput
                ref={inputRef}
                style={styles.commentField}
                placeholder="Add a comment…"
                placeholderTextColor={colors.text3}
                value={commentText}
                onChangeText={setCommentText}
                onSubmitEditing={handleAddComment}
                returnKeyType="send"
                editable={!sending}
              />
              <TouchableOpacity style={styles.sendBtn} onPress={handleAddComment} activeOpacity={0.85} disabled={sending}>
                <Text style={{ color: '#fff', fontSize: 14 }}>{sending ? '…' : '➤'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── New Post Composer (full-screen) ──────────────────────────────────────────

const POST_TYPES = [
  { id: 'workout',  label: 'Workout',  color: '#ff4d00' },
  { id: 'run',      label: 'Run',      color: '#10b981' },
  { id: 'progress', label: 'Progress', color: '#3b82f6' },
  { id: 'general',  label: 'General',  color: '#8b5cf6' },
];

function NewPostModal({ visible, onClose, myUserId, myName, onPosted, initialPhotoUri }) {
  const colors  = useColors();
  const styles  = useMemo(() => makeStyles(colors), [colors]);
  const [title,    setTitle]    = useState('');
  const [caption,  setCaption]  = useState('');
  const [postType, setPostType] = useState('workout');
  const [photoUri, setPhotoUri] = useState(null);
  const [posting,  setPosting]  = useState(false);

  // When opened with a pre-selected photo (from "Photo" speed dial option)
  useEffect(() => {
    if (visible && initialPhotoUri) setPhotoUri(initialPhotoUri);
  }, [visible, initialPhotoUri]);

  const reset = () => { setTitle(''); setCaption(''); setPostType('workout'); setPhotoUri(null); };
  const close = () => { reset(); onClose(); };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow AthloX to access your photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: false, quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow AthloX to use your camera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false, quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const uploadPhoto = async (uri) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const fileName = `${myUserId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from('post-images')
      .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage
      .from('post-images')
      .getPublicUrl(fileName);
    return publicUrl;
  };

  const handlePost = async () => {
    if (!caption.trim() || !myUserId || posting) return;
    setPosting(true);
    try {
      const typeLabel = POST_TYPES.find(t => t.id === postType)?.label || 'Post';
      let imageUrl = null;
      if (photoUri) {
        try { imageUrl = await uploadPhoto(photoUri); } catch { /* post without image */ }
      }
      const workoutData = imageUrl ? { image_url: imageUrl } : {};
      const post = await shareWorkout({
        userId: myUserId, type: postType,
        title: title.trim() || typeLabel,
        caption: caption.trim(), workoutData,
      });
      onPosted({
        id: post.id, userId: myUserId, type: postType,
        title: title.trim() || typeLabel,
        caption: caption.trim(),
        workoutData: imageUrl ? { image_url: imageUrl } : {},
        createdAt: post.created_at, time: 'just now',
        profile: { name: myName }, likeCount: 0, commentCount: 0, liked: false,
      });
      close();
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not post. Try again.');
    } finally {
      setPosting(false);
    }
  };

  const canPost = caption.trim().length > 0 && !posting;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={[styles.npScreen, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          {/* ── Top bar ── */}
          <View style={[styles.npTopBar, { borderBottomColor: colors.border }]}>
            <TouchableOpacity style={styles.npCloseBtn} onPress={close} activeOpacity={0.7}>
              <Text style={[styles.npCloseText, { color: colors.text }]}>✕</Text>
            </TouchableOpacity>
            <Text style={[styles.npScreenTitle, { color: colors.text }]}>New Post</Text>
            <TouchableOpacity
              style={[styles.npPublishBtn, { backgroundColor: canPost ? colors.accent : colors.border }]}
              onPress={handlePost}
              disabled={!canPost}
              activeOpacity={0.85}
            >
              {posting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.npPublishText}>PUBLISH</Text>
              }
            </TouchableOpacity>
          </View>

          {/* ── Scrollable content ── */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.npContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Photo full-width banner */}
            {photoUri && (
              <View style={styles.npPhotoBanner}>
                <Image source={{ uri: photoUri }} style={styles.npPhotoBannerImg} resizeMode="cover" />
                <TouchableOpacity
                  style={[styles.npPhotoRemove, { backgroundColor: 'rgba(0,0,0,0.6)' }]}
                  onPress={() => setPhotoUri(null)}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✕  Remove photo</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Title */}
            <TextInput
              style={[styles.npTitleInput, { color: colors.text }]}
              placeholder="Add an optional title"
              placeholderTextColor={colors.text3}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
              returnKeyType="next"
            />

            {/* Body */}
            <TextInput
              style={[styles.npBodyInput, { color: colors.text }]}
              placeholder="What's going on?"
              placeholderTextColor={colors.text3}
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={500}
              autoFocus={!initialPhotoUri}
            />
          </ScrollView>

          {/* ── Bottom toolbar ── */}
          <View style={[styles.npToolbar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            {/* Photo buttons */}
            <TouchableOpacity style={styles.npToolBtn} onPress={takePhoto} activeOpacity={0.7}>
              <View style={[styles.npToolIcon, { borderColor: colors.border }]}>
                <View style={[styles.npToolIconDot, { backgroundColor: colors.accent }]} />
              </View>
              <Text style={[styles.npToolLabel, { color: colors.text3 }]}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.npToolBtn} onPress={pickFromGallery} activeOpacity={0.7}>
              <View style={[styles.npToolIcon, { borderColor: colors.border }]}>
                <View style={[styles.npToolIconGrid, { borderColor: colors.accent }]} />
              </View>
              <Text style={[styles.npToolLabel, { color: colors.text3 }]}>Gallery</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={[styles.npToolDivider, { backgroundColor: colors.border }]} />

            {/* Post type chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              {POST_TYPES.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.npTypeChip,
                    { borderColor: postType === t.id ? t.color : colors.border,
                      backgroundColor: postType === t.id ? t.color + '18' : 'transparent' },
                  ]}
                  onPress={() => setPostType(t.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.npTypeText, { color: postType === t.id ? t.color : colors.text3 }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ── SocialScreen ──────────────────────────────────────────────────────────────

export default function SocialScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [myUserId, setMyUserId]   = useState(null);
  const [myName, setMyName]       = useState('');
  const [section, setSection]     = useState('feed');
  const [posts, setPosts]         = useState([]);
  const [discoverUsers, setDiscoverUsers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewUserId,    setViewUserId]    = useState(null);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [showNewPost,   setShowNewPost]   = useState(false);
  const [fabOpen,       setFabOpen]       = useState(false);
  const [initialPhoto,  setInitialPhoto]  = useState(null);
  const fabAnim = useRef(new Animated.Value(0)).current;

  // Which user IDs we are following (Set for O(1) lookup)
  const [followingIds, setFollowingIds] = useState(new Set());

  // ── Load current user ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setMyUserId(data.user.id);
        supabase.from('profiles').select('name').eq('id', data.user.id).single()
          .then(({ data: p }) => { if (p?.name) setMyName(p.name); });
      }
    });
  }, []);

  // ── Load feed ──
  const loadFeed = useCallback(async (isRefresh = false) => {
    if (!myUserId) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await fetchPosts(myUserId);
      setPosts(data);
      // Rebuild followingIds from the posts we got
      const ids = new Set(data.filter(p => p.userId !== myUserId).map(() => null).filter(Boolean));
      // Also load discover to sync following state
    } catch (e) {
      console.error('loadFeed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [myUserId]);

  // ── Load discover ──
  const loadDiscover = useCallback(async () => {
    if (!myUserId) return;
    try {
      const data = await fetchDiscoverUsers(myUserId);
      setDiscoverUsers(data);
      setFollowingIds(new Set(data.filter(u => u.isFollowing).map(u => u.id)));
    } catch (e) {
      console.error('loadDiscover', e);
    }
  }, [myUserId]);

  useEffect(() => {
    if (myUserId) {
      Promise.all([loadFeed(), loadDiscover()]).finally(() => setLoading(false));
    }
  }, [myUserId]);

  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([loadFeed(true), loadDiscover()]).finally(() => setRefreshing(false));
  };

  // ── Like toggle (optimistic) ──
  const handleLike = useCallback(async (postId, special) => {
    // special = 'commentCountUp' is a hack from PostCard to bump comment count
    if (special === 'commentCountUp') {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
      return;
    }
    if (!myUserId) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const wasLiked = post.liked;
    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, liked: !wasLiked, likeCount: wasLiked ? p.likeCount - 1 : p.likeCount + 1 }
        : p
    ));
    try {
      await toggleLike(postId, myUserId, wasLiked);
    } catch {
      // Revert on failure
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, liked: wasLiked, likeCount: wasLiked ? p.likeCount + 1 : p.likeCount - 1 }
          : p
      ));
    }
  }, [myUserId, posts]);

  // ── Follow toggle (optimistic) ──
  const handleFollow = useCallback(async (targetUserId) => {
    if (!myUserId) return;
    const isCurrentlyFollowing = followingIds.has(targetUserId);
    // Optimistic update
    setFollowingIds(prev => {
      const next = new Set(prev);
      isCurrentlyFollowing ? next.delete(targetUserId) : next.add(targetUserId);
      return next;
    });
    setDiscoverUsers(prev => prev.map(u =>
      u.id === targetUserId ? { ...u, isFollowing: !isCurrentlyFollowing } : u
    ));
    try {
      await toggleFollowDB(myUserId, targetUserId, isCurrentlyFollowing);
    } catch {
      // Revert
      setFollowingIds(prev => {
        const next = new Set(prev);
        isCurrentlyFollowing ? next.add(targetUserId) : next.delete(targetUserId);
        return next;
      });
      setDiscoverUsers(prev => prev.map(u =>
        u.id === targetUserId ? { ...u, isFollowing: isCurrentlyFollowing } : u
      ));
    }
  }, [myUserId, followingIds]);

  // ── Speed dial helpers ──
  const openFab = () => {
    setFabOpen(true);
    Animated.spring(fabAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };
  const closeFab = () => {
    Animated.spring(fabAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start(() => setFabOpen(false));
  };
  const openPost = () => {
    closeFab();
    setInitialPhoto(null);
    setShowNewPost(true);
  };
  const openPhoto = async () => {
    closeFab();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow AthloX to access your photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: false, quality: 0.8,
    });
    if (!result.canceled) {
      setInitialPhoto(result.assets[0].uri);
      setShowNewPost(true);
    }
  };
  const openCamera = async () => {
    closeFab();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow AthloX to use your camera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'], allowsEditing: false, quality: 0.8,
    });
    if (!result.canceled) {
      setInitialPhoto(result.assets[0].uri);
      setShowNewPost(true);
    }
  };

  // ── Hardware back button: return to feed instead of Today tab ──
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (viewUserId) { setViewUserId(null); return true; }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [viewUserId])
  );

  // ── Filtered data for search ──
  const q = searchQuery.trim().toLowerCase();
  const filteredPosts = q
    ? posts.filter(p => (p.profile?.name || '').toLowerCase().includes(q) || (p.caption || '').toLowerCase().includes(q))
    : posts;
  const filteredUsers = q
    ? discoverUsers.filter(u => (u.name || '').toLowerCase().includes(q))
    : discoverUsers;

  // ── User profile view ──
  if (viewUserId) {
    return (
      <UserProfile
        userId={viewUserId}
        myUserId={myUserId}
        onBack={() => setViewUserId(null)}
      />
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.container} edges={['top']}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.pageTitle}>Community</Text>
            <HeaderActions />
          </View>

          {/* Search bar */}
          <View style={[styles.searchBar, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.searchIcon, { color: colors.text3 }]}>⌕</Text>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search people or posts…"
              placeholderTextColor={colors.text3}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                <Text style={[styles.searchClear, { color: colors.text3 }]}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.tabs}>
            {[['feed', 'Feed'], ['discover', 'Discover']].map(([id, label]) => (
              <TouchableOpacity key={id} style={styles.tab} onPress={() => setSection(id)} activeOpacity={0.8}>
                <Text style={[styles.tabText, section === id && styles.tabTextActive]}>{label}</Text>
                {section === id && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Feed */}
        {section === 'feed' && (
          loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.accent} size="large" />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
            >
              {filteredPosts.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyEmoji}>👥</Text>
                  <Text style={styles.emptyTitle}>{q ? 'No results' : 'No posts yet'}</Text>
                  <Text style={styles.emptySub}>{q ? `No posts matching "${searchQuery}"` : 'Complete a workout and share it to get started!'}</Text>
                </View>
              ) : filteredPosts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  myUserId={myUserId}
                  myName={myName}
                  onLike={handleLike}
                  onViewUser={setViewUserId}
                  onFollow={handleFollow}
                  followingIds={followingIds}
                />
              ))}
            </ScrollView>
          )
        )}

        {/* Discover */}
        {section === 'discover' && (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
          >
            <Text style={styles.discoverSub}>Find and follow fitness enthusiasts</Text>
            {filteredUsers.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyTitle}>{q ? 'No results' : 'No users yet'}</Text>
                <Text style={styles.emptySub}>{q ? `No users matching "${searchQuery}"` : 'Invite friends to join AthloX!'}</Text>
              </View>
            ) : filteredUsers.map(u => (
              <View key={u.id} style={[styles.card, styles.discoverCard]}>
                <TouchableOpacity onPress={() => setViewUserId(u.id)} activeOpacity={0.8}>
                  <Avatar name={u.name} size={48} />
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => setViewUserId(u.id)} activeOpacity={0.8}>
                  <Text style={styles.posterName}>{u.name}</Text>
                  <Text style={styles.posterMeta}>{u.level || 'Member'}{u.streak > 0 ? ` · 🔥 ${u.streak} day streak` : ''}</Text>
                  {u.workouts > 0 && <Text style={styles.discoverBio}>{u.workouts} workouts completed</Text>}
                </TouchableOpacity>
                {myUserId !== u.id && (
                  <TouchableOpacity
                    style={[styles.smallFollowBtn, u.isFollowing && styles.followingBtn]}
                    onPress={() => handleFollow(u.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.smallFollowText, u.isFollowing && { color: colors.text2 }]}>
                      {u.isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        )}

      </SafeAreaView>

      {/* ── Speed dial FAB ── */}
      {!viewUserId && (
        <>
          {/* Backdrop — closes dial on tap */}
          {fabOpen && (
            <TouchableOpacity
              style={styles.fabBackdrop}
              activeOpacity={1}
              onPress={closeFab}
            />
          )}

          {/* Action items — slide up above FAB */}
          {fabOpen && (
            <View style={styles.fabActions}>
              {[
                { label: 'New Post', icon: '≡', onPress: openPost,   delay: 0   },
                { label: 'Camera',   icon: '◎', onPress: openCamera, delay: 60  },
                { label: 'Gallery',  icon: '▣', onPress: openPhoto,  delay: 120 },
              ].map(({ label, icon, onPress, delay }, i) => {
                const translateY = fabAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, -(i * 64 + 80)],
                });
                const opacity = fabAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
                return (
                  <Animated.View key={label} style={[styles.fabActionRow, { transform: [{ translateY }], opacity }]}>
                    <Text style={[styles.fabActionLabel, { color: colors.text, backgroundColor: colors.surface }]}>
                      {label}
                    </Text>
                    <TouchableOpacity
                      style={[styles.fabActionCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={onPress}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.fabActionIcon, { color: colors.accent }]}>{icon}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          )}

          {/* Main FAB */}
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.accent }]}
            onPress={fabOpen ? closeFab : openFab}
            activeOpacity={0.85}
          >
            <Animated.Text style={[styles.fabIcon, {
              transform: [{
                rotate: fabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] })
              }]
            }]}>
              +
            </Animated.Text>
          </TouchableOpacity>
        </>
      )}

      <NewPostModal
        visible={showNewPost}
        onClose={() => setShowNewPost(false)}
        myUserId={myUserId}
        myName={myName}
        initialPhotoUri={initialPhoto}
        onPosted={newPost => {
          setPosts(prev => [newPost, ...prev]);
          setShowNewPost(false);
        }}
      />

    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (colors) => StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },
  scroll:         { padding: 12, paddingBottom: 24 },

  header:         { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 16 },
  headerTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingBottom: 8 },
  searchBar:      { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, gap: 8 },
  searchIcon:     { fontSize: 14 },
  searchInput:    { flex: 1, fontSize: 14, paddingVertical: 0 },
  searchClear:    { fontSize: 14, padding: 2 },
  pageTitle:      { fontSize: 30, fontWeight: '900', color: colors.text },
  tabs:           { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border },
  tab:            { flex: 1, alignItems: 'center', paddingVertical: 13, position: 'relative' },
  tabText:        { fontSize: 14, fontWeight: '600', color: colors.text3 },
  tabTextActive:  { color: colors.accent },
  tabIndicator:   { position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 2, backgroundColor: colors.accent, borderRadius: 1 },

  card:           { backgroundColor: colors.surface, borderRadius: 18, marginBottom: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },

  postHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingBottom: 0 },
  posterName:     { fontSize: 15, fontWeight: '700', color: colors.text },
  posterMeta:     { fontSize: 12, color: colors.text3 },
  smallFollowBtn: { backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  followingBtn:   { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  smallFollowText:{ fontSize: 12, fontWeight: '700', color: '#fff' },
  caption:        { fontSize: 14, color: colors.text, lineHeight: 20, paddingHorizontal: 14, paddingTop: 10 },
  postStats:      { margin: 12, backgroundColor: colors.bg, borderRadius: 14, padding: 14 },
  postTitle:      { fontSize: 15, fontWeight: '700', color: colors.text },
  postMeta:       { fontSize: 12, color: colors.text2, marginTop: 4 },
  statVal:        { fontSize: 18, fontWeight: '700', color: colors.text },
  statLabel:      { fontSize: 11, color: colors.text2, marginTop: 2 },
  postActions:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 10 },
  actionBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 60, padding: 8 },
  actionIcon:     { fontSize: 20 },
  actionText:     { fontSize: 14, fontWeight: '600', color: colors.text3 },

  commentsSection:{ borderTopWidth: 1, borderTopColor: colors.border, padding: 12 },
  commentRow:     { flexDirection: 'row', gap: 8, marginBottom: 8 },
  commentBubble:  { backgroundColor: colors.bg, borderRadius: 12, padding: 10, flex: 1 },
  commentName:    { fontSize: 12, fontWeight: '700', color: colors.text2 },
  commentText:    { fontSize: 13, color: colors.text, marginTop: 2 },
  commentInput:   { flexDirection: 'row', gap: 8, marginTop: 8 },
  commentField:   { flex: 1, backgroundColor: colors.bg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text },
  sendBtn:        { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },

  profileHeader:  { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, padding: 16, paddingTop: 56 },
  backBtn:        { marginBottom: 12 },
  backText:       { fontSize: 15, fontWeight: '600', color: colors.text2 },
  profileTop:     { flexDirection: 'row', gap: 16, alignItems: 'flex-start', marginBottom: 16 },
  profileName:    { fontSize: 18, fontWeight: '700', color: colors.text },
  profileBio:     { fontSize: 13, color: colors.text2, marginTop: 4 },
  levelBadge:     { backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 4 },
  levelText:      { fontSize: 11, fontWeight: '600', color: colors.text2 },
  profileStats:   { flexDirection: 'row', paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border },
  profileStatVal: { fontSize: 20, fontWeight: '700', color: colors.text },
  profileStatLabel: { fontSize: 12, color: colors.text2 },
  followBtn:      { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginBottom: 16 },
  followBtnActive:{ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  followBtnText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  followBtnTextActive: { color: colors.text2 },

  discoverCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  discoverSub:    { fontSize: 14, color: colors.text2, marginBottom: 12 },
  discoverBio:    { fontSize: 12, color: colors.text2, marginTop: 2 },

  emptyBox:       { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji:     { fontSize: 48, marginBottom: 12 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
  emptySub:       { fontSize: 14, color: colors.text3, textAlign: 'center', lineHeight: 20 },

  // ── FAB + Speed dial ──
  fab:              { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10 },
  fabIcon:          { fontSize: 30, color: '#fff', fontWeight: '300', lineHeight: 34 },
  fabBackdrop:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  fabActions:       { position: 'absolute', bottom: 0, right: 0, left: 0, top: 0, pointerEvents: 'box-none' },
  fabActionRow:     { position: 'absolute', bottom: 24, right: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fabActionLabel:   { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, fontSize: 14, fontWeight: '700', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  fabActionCircle:  { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 4 },
  fabActionIcon:    { fontSize: 18, fontWeight: '700', lineHeight: 22 },

  // ── Full-screen post composer ──
  npScreen:         { flex: 1 },
  npTopBar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  npCloseBtn:       { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  npCloseText:      { fontSize: 18, fontWeight: '600' },
  npScreenTitle:    { fontSize: 17, fontWeight: '800' },
  npPublishBtn:     { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, minWidth: 80, alignItems: 'center' },
  npPublishText:    { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  npContent:        { paddingHorizontal: 20, paddingBottom: 20 },
  npPhotoBanner:    { marginHorizontal: -20, marginBottom: 16, position: 'relative' },
  npPhotoBannerImg: { width: '100%', height: 240 },
  npPhotoRemove:    { position: 'absolute', top: 10, right: 10, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  npTitleInput:     { fontSize: 22, fontWeight: '700', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  npBodyInput:      { fontSize: 16, lineHeight: 24, paddingVertical: 12, minHeight: 160, textAlignVertical: 'top' },
  npToolbar:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
  npToolBtn:        { alignItems: 'center', gap: 3 },
  npToolIcon:       { width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  npToolIconDot:    { width: 10, height: 10, borderRadius: 5 },
  npToolIconGrid:   { width: 14, height: 14, borderWidth: 1.5, borderRadius: 2 },
  npToolLabel:      { fontSize: 10, fontWeight: '600' },
  npToolDivider:    { width: 1, height: 28, marginHorizontal: 4 },
  npTypeChip:       { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 5, marginRight: 6 },
  npTypeText:       { fontSize: 12, fontWeight: '700' },

  postImage:        { width: '100%', height: 220, marginTop: 10 },
});
