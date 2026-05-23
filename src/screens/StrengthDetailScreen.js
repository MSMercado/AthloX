// v2.0 — StrengthDetailScreen. Tap a strength card in the Activities tab →
// land here. Mirrors RunSummary's structure (hero / stats / detail / notes /
// AI insights / delete) so the two detail screens feel like the same app.
//
// Loaded by id from strength_sessions, which we populated in finishStrength.
// Older sessions (before v2.0) won't have a session id stitched onto their
// log entry — the Activities tab keeps the Alert fallback for those.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import useColors from '../lib/useColors';
import {
  getStrengthSession, updateStrengthSession, deleteStrengthSession,
} from '../lib/strengthSessions';

// ── Formatting ──────────────────────────────────────────────────────────────

function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ── Component ───────────────────────────────────────────────────────────────

export default function StrengthDetailScreen() {
  const colors = useColors();
  const navigation = useNavigation();
  const route = useRoute();
  const { sessionId } = route.params || {};
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft]     = useState('');
  const [savingNote, setSavingNote]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getStrengthSession(sessionId);
        if (cancelled) return;
        if (!s) { setError('Session not found'); }
        else    { setSession(s); }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load session');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const totalSets    = (session?.exercises || []).reduce((s, ex) => s + (ex.sets?.length || 0), 0);
  const completedSets = (session?.exercises || []).reduce(
    (s, ex) => s + (ex.sets || []).filter(st => st.completed).length, 0);

  const handleSaveNote = async () => {
    if (savingNote) return;
    setSavingNote(true);
    try {
      const updated = await updateStrengthSession(session.id, { notes: noteDraft.trim() });
      setSession(updated);
      setEditingNote(false);
    } catch (e) {
      Alert.alert('Could not save note', e?.message || 'Try again');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete this session?',
      'This permanently removes the workout details and AI insights.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteStrengthSession(session.id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Could not delete', e?.message || 'Try again');
          }
        }},
      ]
    );
  }, [session, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading session…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
        <View style={styles.loadingWrap}>
          <Text style={[styles.loadingText, { color: '#ef4444' }]}>{error || 'Not available'}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const accentCol = colors.accent;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={handleDelete} style={styles.headerAction}>
          <Text style={styles.headerActionText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.heroSection}>
          <Text style={styles.heroDate}>{fmtDate(session.startedAt)}</Text>
          <Text style={styles.heroTitle}>{session.routineName || 'Workout'}</Text>
          <View style={styles.heroStatsRow}>
            <Stat value={fmtTime(session.durationSec)} label="Time"     />
            <Stat value={`${session.calories ?? '—'}`} label="Calories" />
            <Stat value={`${completedSets}/${totalSets}`} label="Sets"   />
          </View>
        </View>

        {/* Exercises */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Exercises</Text>
          {(session.exercises || []).length === 0 ? (
            <View style={[styles.box, { borderColor: accentCol + '33' }]}>
              <Text style={styles.boxBody}>No exercise detail was saved for this session.</Text>
            </View>
          ) : (
            (session.exercises || []).map(ex => (
              <View key={ex.id} style={[styles.exCard, { borderColor: accentCol + '33' }]}>
                <View style={styles.exHeader}>
                  <Text style={styles.exName}>{ex.name}</Text>
                  <Text style={styles.exMeta}>
                    {(ex.sets || []).filter(s => s.completed).length}/{(ex.sets || []).length} sets
                  </Text>
                </View>
                {(ex.sets || []).length > 0 && (
                  <View style={styles.setRows}>
                    {ex.sets.map((set, i) => (
                      <View key={i} style={styles.setRow}>
                        <Text style={[styles.setIdx, { color: colors.text3 }]}>Set {i + 1}</Text>
                        <Text style={styles.setMeta}>
                          {set.reps ? `${set.reps} reps` : '—'}
                          {set.weight ? ` · ${set.weight}` : ''}
                        </Text>
                        <View style={[
                          styles.setCheck,
                          set.completed
                            ? { backgroundColor: '#10b981', borderColor: '#10b981' }
                            : { borderColor: '#444' }
                        ]}>
                          {set.completed && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>✓</Text>}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <TouchableOpacity
              onPress={() => { setNoteDraft(session.notes || ''); setEditingNote(true); }}
              activeOpacity={0.7}
            >
              <Text style={{ color: accentCol, fontSize: 13, fontWeight: '700' }}>
                {session.notes ? 'Edit' : '+ Add note'}
              </Text>
            </TouchableOpacity>
          </View>
          {session.notes ? (
            <View style={[styles.box, { borderColor: accentCol + '33' }]}>
              <Text style={styles.boxBody}>{session.notes}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={editingNote} animationType="fade" transparent onRequestClose={() => !savingNote && setEditingNote(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#111', borderRadius: 16, padding: 18 }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 10 }}>Add a note</Text>
            <Text style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>
              How did the session feel? Any PRs, soreness, energy level?
            </Text>
            <TextInput
              style={{ backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, color: '#fff', fontSize: 15, minHeight: 120, textAlignVertical: 'top' }}
              value={noteDraft}
              onChangeText={setNoteDraft}
              placeholder="Type your note..."
              placeholderTextColor="#555"
              multiline
              maxLength={500}
              editable={!savingNote}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#333', alignItems: 'center' }}
                onPress={() => setEditingNote(false)}
                disabled={savingNote}
                activeOpacity={0.7}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 10, backgroundColor: accentCol, alignItems: 'center', opacity: savingNote ? 0.5 : 1 }}
                onPress={handleSaveNote}
                disabled={savingNote}
                activeOpacity={0.85}
              >
                {savingNote
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '800' }}>Save</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ value, label }) {
  return (
    <View style={{ marginRight: 24 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: '#888', fontSize: 11, fontWeight: '600', marginTop: 2, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  loadingText: { color: '#fff', fontSize: 15 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  backBtn: { paddingVertical: 8, paddingRight: 12 },
  backBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  headerAction: { paddingVertical: 8, paddingHorizontal: 12 },
  headerActionText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },

  heroSection: { paddingHorizontal: 24, paddingBottom: 24 },
  heroDate: { color: '#888', fontSize: 13, fontWeight: '600' },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 4, marginBottom: 18 },
  heroStatsRow: { flexDirection: 'row' },

  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionLabel: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },

  box: { backgroundColor: '#0f0f0f', borderRadius: 14, padding: 16, borderWidth: 1 },
  boxBody: { color: '#fff', fontSize: 14, lineHeight: 22 },

  exCard: { backgroundColor: '#0f0f0f', borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 10 },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  exName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  exMeta: { color: '#888', fontSize: 12, fontWeight: '600' },

  setRows: { gap: 6 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  setIdx: { width: 60, fontSize: 12, fontWeight: '700' },
  setMeta: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  setCheck: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
