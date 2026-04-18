import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, Modal, Switch, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import useStore from '../store/useStore';
import useColors from '../lib/useColors';
import { shadow } from '../lib/theme';
import { applyNotificationSettings, requestNotificationPermission } from '../lib/notifications';
import { getLevelInfo, LEVELS } from '../lib/xp';

const LEVEL_COLORS = {
  Beginner:     { bg: '#f0fdf4', text: '#10b981' },
  Intermediate: { bg: '#fff0eb', text: '#ff4d00' },
  Advanced:     { bg: '#fef2f2', text: '#ef4444' },
};

function Avatar({ name, photoUri, size = 80, colors, onPress }) {
  const initials = (name || 'U')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ marginBottom: 14 }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {photoUri
          ? <Image source={{ uri: photoUri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
          : <Text style={{ fontSize: size * 0.35, color: '#fff', fontWeight: '800' }}>{initials}</Text>
        }
      </View>
      {/* Camera icon overlay */}
      <View style={{ position: 'absolute', bottom: 0, right: 0, width: size * 0.32, height: size * 0.32, borderRadius: size * 0.16, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: size * 0.16, color: '#fff' }}>📷</Text>
      </View>
    </TouchableOpacity>
  );
}

function StatPill({ value, label, styles }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function WorkoutHistoryItem({ log, colors, styles }) {
  const date = new Date(log.date || log.id);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const isGPS = log.type === 'gps';
  const icon = isGPS ? '🏃' : '💪';
  const title = log.routineName || (isGPS ? 'Outdoor Run' : 'Workout');
  const detail = isGPS
    ? `${(log.distance || 0).toFixed(2)} km · ${log.duration || 0} min`
    : `${log.exercises?.length || 0} exercises · ${log.duration || 0} min`;

  return (
    <View style={styles.historyItem}>
      <View style={styles.historyIcon}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.historyTitle}>{title}</Text>
        <Text style={styles.historyDetail}>{detail}</Text>
      </View>
      <Text style={styles.historyDate}>{dateStr}</Text>
    </View>
  );
}

// ─── Settings Modal ──────────────────────────────────────────────────────────
function SettingsModal({ visible, onClose, user, onLogout, loggingOut }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { darkMode, toggleDarkMode, notifSettings, setNotifSettings } = useStore();

  const meta      = user?.user_metadata || {};
  const level     = meta.level     || 'Beginner';
  const goals     = meta.goals     || [];
  const equipment = meta.equipment || [];

  const [unitMetric, setUnitMetric] = useState(true);

  // Notification toggles — backed by persistent store + actually schedule/cancel
  const toggleNotif = async (key, value) => {
    const updated = { ...notifSettings, [key]: value };
    setNotifSettings(updated);
    const granted = await requestNotificationPermission();
    if (granted) applyNotificationSettings(updated);
  };

  const SettingRow = ({ icon, label, value, onPress, right, noBorder }) => (
    <TouchableOpacity
      style={[styles.settingRow, noBorder && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingLeft}>
        <Text style={styles.settingIcon}>{icon}</Text>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      {right || (value !== undefined
        ? <Text style={styles.settingValue}>{value}</Text>
        : <Text style={styles.settingArrow}>›</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer} edges={['top']}>

        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Settings</Text>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.modalCloseText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>

          {/* Account Info */}
          <Text style={styles.settingGroupLabel}>Account</Text>
          <View style={styles.settingCard}>
            <SettingRow icon="📧" label="Email" value={user?.email || '—'} />
            <SettingRow icon="🗓️" label="Member since"
              value={user?.created_at
                ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                : '—'}
            />
            <SettingRow icon="🏅" label="Fitness level" value={level} noBorder />
          </View>

          {/* Goals & Equipment */}
          {goals.length > 0 && (
            <>
              <Text style={styles.settingGroupLabel}>My Goals</Text>
              <View style={styles.settingCard}>
                <View style={[styles.settingRow, { borderBottomWidth: 0, flexWrap: 'wrap' }]}>
                  <View style={styles.chipRow}>
                    {goals.map((g, i) => (
                      <View key={i} style={styles.chip}><Text style={styles.chipText}>{g}</Text></View>
                    ))}
                  </View>
                </View>
              </View>
            </>
          )}

          {equipment.length > 0 && (
            <>
              <Text style={styles.settingGroupLabel}>Equipment</Text>
              <View style={styles.settingCard}>
                <View style={[styles.settingRow, { borderBottomWidth: 0, flexWrap: 'wrap' }]}>
                  <View style={styles.chipRow}>
                    {equipment.map((e, i) => (
                      <View key={i} style={[styles.chip, styles.chipAlt]}><Text style={[styles.chipText, styles.chipTextAlt]}>{e}</Text></View>
                    ))}
                  </View>
                </View>
              </View>
            </>
          )}

          {/* Preferences */}
          <Text style={styles.settingGroupLabel}>Preferences</Text>
          <View style={styles.settingCard}>
            <SettingRow
              icon={darkMode ? '☀️' : '🌙'}
              label={darkMode ? 'Light Mode' : 'Dark Mode'}
              right={<Switch value={darkMode} onValueChange={toggleDarkMode} trackColor={{ true: colors.accent }} thumbColor="#fff" />}
            />
            <SettingRow
              icon="📏"
              label="Metric units (km, kg)"
              right={<Switch value={unitMetric} onValueChange={setUnitMetric} trackColor={{ true: colors.accent }} thumbColor="#fff" />}
            />
            <SettingRow
              icon="🔔"
              label="Daily workout reminder (8 AM)"
              right={<Switch value={notifSettings?.workout ?? true} onValueChange={v => toggleNotif('workout', v)} trackColor={{ true: colors.accent }} thumbColor="#fff" />}
            />
            <SettingRow
              icon="🔥"
              label="Streak protection (7:30 PM)"
              right={<Switch value={notifSettings?.streak ?? true} onValueChange={v => toggleNotif('streak', v)} trackColor={{ true: colors.accent }} thumbColor="#fff" />}
            />
            <SettingRow
              icon="✨"
              label="Weekly coach tip (Mondays)"
              right={<Switch value={notifSettings?.coach ?? false} onValueChange={v => toggleNotif('coach', v)} trackColor={{ true: colors.accent }} thumbColor="#fff" />}
              noBorder
            />
          </View>

          {/* Support */}
          <Text style={styles.settingGroupLabel}>Support</Text>
          <View style={styles.settingCard}>
            <SettingRow icon="⭐" label="Rate AthloX" onPress={() => Alert.alert('Thank you!', 'Rating will be available when the app is published.')} />
            <SettingRow icon="💬" label="Send feedback" onPress={() => Alert.alert('Feedback', 'Coming soon!')} />
            <SettingRow icon="📄" label="Privacy Policy" onPress={() => Alert.alert('Privacy Policy', 'Coming soon!')} noBorder />
          </View>

          {/* App Info */}
          <Text style={styles.settingGroupLabel}>App</Text>
          <View style={styles.settingCard}>
            <SettingRow icon="📱" label="Version" value="1.0.0" noBorder />
          </View>

          {/* Danger Zone */}
          <TouchableOpacity
            style={[styles.logoutBtn, loggingOut && { opacity: 0.6 }]}
            onPress={onLogout}
            disabled={loggingOut}
            activeOpacity={0.85}
          >
            {loggingOut
              ? <ActivityIndicator color={colors.red} size="small" />
              : <>
                  <Text style={styles.logoutIcon}>🚪</Text>
                  <Text style={styles.logoutText}>Log Out</Text>
                </>
            }
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, logs, xp, setUser } = useStore();
  const levelInfo = getLevelInfo(xp);
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [editing, setEditing]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [photoUri, setPhotoUri]     = useState(user?.user_metadata?.avatar_url || null);

  const meta = user?.user_metadata || {};
  const [name, setName]               = useState(meta.full_name || '');
  const [displayNameEdit, setDisplayNameEdit] = useState(meta.display_name || '');
  const [bio, setBio]                 = useState(meta.bio || '');

  const displayName = meta.display_name || meta.full_name || user?.email?.split('@')[0] || 'Athlete';
  const username    = '@' + (user?.email?.split('@')[0] || 'user').toLowerCase().replace(/[^a-z0-9]/g, '');
  const level       = meta.level || 'Beginner';
  const goals       = meta.goals || [];
  const equipment   = meta.equipment || [];
  const streak = (() => {
    if (logs.length === 0) return 0;
    const sorted = [...logs].sort((a, b) => new Date(b.date || b.id) - new Date(a.date || a.id));
    let count = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date || sorted[i - 1].id);
      const curr = new Date(sorted[i].date || sorted[i].id);
      const diff = (prev - curr) / (1000 * 60 * 60 * 24);
      if (diff <= 1) count++;
      else break;
    }
    return count;
  })();

  const levelStyle = LEVEL_COLORS[level] || LEVEL_COLORS.Beginner;

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Name cannot be empty'); return; }
    setSaving(true);
    const { data, error } = await supabase.auth.updateUser({
      data: { full_name: name.trim(), display_name: displayNameEdit.trim(), bio: bio.trim() },
    });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setUser(data.user);
      setEditing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out', style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            await supabase.auth.signOut();
          },
        },
      ]
    );
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow AthloX to access your photos to update your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setPhotoUri(uri);
    // Save to Supabase user metadata
    await supabase.auth.updateUser({ data: { avatar_url: uri } });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.pageTitle}>Profile</Text>
          </View>
          {!editing && (
            <View style={styles.headerBtns}>
              {/* Edit button */}
              <TouchableOpacity style={styles.headerBtn} onPress={() => setEditing(true)} activeOpacity={0.8}>
                <Text style={styles.headerBtnText}>Edit</Text>
              </TouchableOpacity>
              {/* Settings gear */}
              <TouchableOpacity style={[styles.headerBtn, styles.gearBtn]} onPress={() => setShowSettings(true)} activeOpacity={0.8}>
                <Text style={styles.gearIcon}>⚙️</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Avatar name={displayName} photoUri={photoUri} size={80} colors={colors} onPress={pickPhoto} />

          {editing ? (
            <View style={styles.editFields}>
              <TextInput
                style={styles.editInput}
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor={colors.text3}
              />
              <TextInput
                style={styles.editInput}
                value={displayNameEdit}
                onChangeText={setDisplayNameEdit}
                placeholder="Display name (optional — shown on dashboard)"
                placeholderTextColor={colors.text3}
                maxLength={30}
              />
              <TextInput
                style={[styles.editInput, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="Short bio (e.g. 'Running my first marathon 🏅')"
                placeholderTextColor={colors.text3}
                multiline
                maxLength={120}
              />
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={styles.cancelEditBtn}
                  onPress={() => { setEditing(false); setName(meta.full_name || ''); setDisplayNameEdit(meta.display_name || ''); setBio(meta.bio || ''); }}
                >
                  <Text style={styles.cancelEditText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveEditBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.saveEditText}>Save Changes</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.displayName}>{displayName}</Text>
              <Text style={styles.username}>{username}</Text>
              {meta.bio ? <Text style={styles.bio}>{meta.bio}</Text> : null}
              <View style={[styles.levelBadge, { backgroundColor: levelStyle.bg }]}>
                <Text style={[styles.levelText, { color: levelStyle.text }]}>{level}</Text>
              </View>

              {/* XP Level Bar */}
              <View style={[styles.xpCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                <View style={styles.xpCardHeader}>
                  <Text style={styles.xpCardEmoji}>{levelInfo.current.emoji}</Text>
                  <View>
                    <Text style={[styles.xpCardTitle, { color: colors.text }]}>
                      Level {levelInfo.current.level} — {levelInfo.current.title}
                    </Text>
                    <Text style={[styles.xpCardSub, { color: colors.text3 }]}>
                      {xp.toLocaleString()} XP total
                    </Text>
                  </View>
                  {levelInfo.next && (
                    <View style={[styles.xpNextBadge, { backgroundColor: colors.accent + '15', borderColor: colors.accent + '30' }]}>
                      <Text style={[styles.xpNextText, { color: colors.accent }]}>Next: {levelInfo.next.title}</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.xpTrack, { backgroundColor: colors.border }]}>
                  <View style={[styles.xpFill, { backgroundColor: colors.accent, width: `${Math.round(levelInfo.progress * 100)}%` }]} />
                </View>
                <Text style={[styles.xpMeta, { color: colors.text3 }]}>
                  {levelInfo.next
                    ? `${levelInfo.xpIntoLevel.toLocaleString()} / ${levelInfo.xpForNextLevel.toLocaleString()} XP to Level ${levelInfo.next.level}`
                    : '👑 Maximum level reached'
                  }
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatPill value={logs.length} label="Workouts" styles={styles} />
          <View style={styles.statDivider} />
          <StatPill value={streak} label="Day Streak" styles={styles} />
          <View style={styles.statDivider} />
          <StatPill value={goals.length} label="Goals" styles={styles} />
        </View>

        {/* Goals */}
        {goals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Goals</Text>
            <View style={styles.chipRow}>
              {goals.map((g, i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText}>{g}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Equipment */}
        {equipment.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Equipment</Text>
            <View style={styles.chipRow}>
              {equipment.map((e, i) => (
                <View key={i} style={[styles.chip, styles.chipAlt]}>
                  <Text style={[styles.chipText, styles.chipTextAlt]}>{e}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Workout History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Workout History</Text>
          {logs.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyHistoryEmoji}>📋</Text>
              <Text style={styles.emptyHistoryText}>No workouts yet — hit the Track tab to get started!</Text>
            </View>
          ) : (
            <View style={styles.historyList}>
              {logs.slice(0, 10).map((log, i) => (
                <WorkoutHistoryItem key={i} log={log} colors={colors} styles={styles} />
              ))}
              {logs.length > 10 && (
                <Text style={styles.moreText}>+ {logs.length - 10} more workouts</Text>
              )}
            </View>
          )}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Settings Modal */}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        user={user}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg },
  scroll:       { paddingHorizontal: 16, paddingBottom: 32 },

  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, paddingBottom: 14 },
  headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backBtn:      { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  backIcon:     { fontSize: 32, color: colors.text, lineHeight: 34, marginTop: -2 },
  pageTitle:    { fontSize: 34, fontWeight: '900', color: colors.text },
  headerBtns:   { flexDirection: 'row', gap: 8, alignItems: 'center' },
  headerBtn:    { backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  headerBtnText:{ color: colors.text, fontSize: 13, fontWeight: '700' },
  gearBtn:      { paddingHorizontal: 12 },
  gearIcon:     { fontSize: 20 },

  profileCard:  { backgroundColor: colors.surface, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: 12, ...shadow.card },
  avatar:       { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarText:   { color: '#fff', fontWeight: '800' },
  displayName:  { fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: 2 },
  username:     { fontSize: 14, color: colors.text3, marginBottom: 8 },
  bio:          { fontSize: 14, color: colors.text2, textAlign: 'center', marginBottom: 10, lineHeight: 20 },
  levelBadge:   { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 5, marginTop: 6 },
  levelText:    { fontSize: 12, fontWeight: '700' },

  xpCard:       { width: '100%', borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 14, gap: 8 },
  xpCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  xpCardEmoji:  { fontSize: 24 },
  xpCardTitle:  { fontSize: 14, fontWeight: '800' },
  xpCardSub:    { fontSize: 12, marginTop: 1 },
  xpNextBadge:  { marginLeft: 'auto', borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  xpNextText:   { fontSize: 11, fontWeight: '700' },
  xpTrack:      { height: 8, borderRadius: 4, width: '100%', overflow: 'hidden' },
  xpFill:       { height: 8, borderRadius: 4 },
  xpMeta:       { fontSize: 11, textAlign: 'center', fontWeight: '600' },

  editFields:   { width: '100%', marginTop: 8 },
  editInput:    { backgroundColor: colors.bg, borderRadius: 12, padding: 14, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  bioInput:     { minHeight: 72, textAlignVertical: 'top' },
  editActions:  { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelEditBtn:{ flex: 1, backgroundColor: colors.bg, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  cancelEditText:{ fontSize: 14, fontWeight: '600', color: colors.text2 },
  saveEditBtn:  { flex: 2, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveEditText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  statsRow:     { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 12, ...shadow.card, alignItems: 'center' },
  statPill:     { flex: 1, alignItems: 'center' },
  statValue:    { fontSize: 26, fontWeight: '900', color: colors.text },
  statLabel:    { fontSize: 11, color: colors.text3, marginTop: 2, fontWeight: '600' },
  statDivider:  { width: 1, height: 36, backgroundColor: colors.border },

  section:      { marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 10 },

  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { backgroundColor: colors.accent + '18', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  chipText:     { fontSize: 13, color: colors.accent, fontWeight: '600' },
  chipAlt:      { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  chipTextAlt:  { color: colors.text2 },

  historyList:      { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },
  historyItem:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyIcon:      { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  historyTitle:     { fontSize: 14, fontWeight: '600', color: colors.text },
  historyDetail:    { fontSize: 12, color: colors.text3, marginTop: 2 },
  historyDate:      { fontSize: 12, color: colors.text3 },
  moreText:         { textAlign: 'center', fontSize: 13, color: colors.text3, padding: 14 },
  emptyHistory:     { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 28, alignItems: 'center' },
  emptyHistoryEmoji:{ fontSize: 32, marginBottom: 10 },
  emptyHistoryText: { fontSize: 14, color: colors.text2, textAlign: 'center', lineHeight: 20 },

  modalContainer: { flex: 1, backgroundColor: colors.bg },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  modalTitle:     { fontSize: 18, fontWeight: '800', color: colors.text },
  modalCloseBtn:  { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  modalCloseText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalScroll:    { paddingHorizontal: 16, paddingTop: 20 },

  settingGroupLabel: { fontSize: 11, fontWeight: '700', color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  settingCard:    { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: 20, ...shadow.card },
  settingRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  settingLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingIcon:    { fontSize: 18, width: 26 },
  settingLabel:   { fontSize: 14, color: colors.text, fontWeight: '500', flex: 1 },
  settingValue:   { fontSize: 14, color: colors.text3, fontWeight: '500', maxWidth: '50%', textAlign: 'right' },
  settingArrow:   { fontSize: 20, color: colors.text3 },

  logoutBtn:      { flexDirection: 'row', gap: 8, backgroundColor: '#fef2f2', borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 8, borderWidth: 1, borderColor: '#fecaca' },
  logoutIcon:     { fontSize: 18 },
  logoutText:     { color: colors.red, fontSize: 15, fontWeight: '700' },
});
