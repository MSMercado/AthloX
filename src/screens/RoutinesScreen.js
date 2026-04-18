import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import useStore from '../store/useStore';
import { EXERCISES, SAMPLE_ROUTINES } from '../data/exercises';
import useColors from '../lib/useColors';
import { shadow } from '../lib/theme';
import HeaderActions from '../components/HeaderActions';

const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core', 'Full Body'];
const ROUTINE_COLORS = ['#ff4d00', '#10b981', '#3b82f6', '#8b5cf6'];

function resolveExercises(r) {
  if (!r?.exercises?.length) return [];
  if (typeof r.exercises[0] === 'object') return r.exercises;
  return r.exercises.map(id => EXERCISES.find(e => e.id === id)).filter(Boolean);
}

const diffColor = d => d === 'Advanced' ? '#ef4444' : d === 'Intermediate' ? '#ff4d00' : '#10b981';
const diffBg    = d => d === 'Advanced' ? '#fef2f2' : d === 'Intermediate' ? '#fff0eb' : '#f0fdf4';

/* ─── Create Routine Screen ─── */
function CreateRoutine({ onSave, onBack }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [sel, setSel]   = useState([]);

  const toggle = id => setSel(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);

  const save = () => {
    if (!name.trim()) { Alert.alert('Give your routine a name'); return; }
    if (!sel.length)  { Alert.alert('Select at least one exercise'); return; }
    onSave({ id: Date.now(), name: name.trim(), exercises: sel, duration: sel.length * 8, color: ROUTINE_COLORS[Math.floor(Math.random() * ROUTINE_COLORS.length)] });
  };

  return (
    <View style={styles.container}>
      <View style={styles.createHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Workouts</Text>
        </TouchableOpacity>
        <Text style={styles.createTitle}>New Routine</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.nameInput}
          placeholder="Routine name…"
          placeholderTextColor={colors.text3}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.selectLabel}>Select Exercises ({sel.length} selected)</Text>

        {MUSCLES.map(muscle => {
          const group = EXERCISES.filter(e => e.muscle === muscle);
          if (!group.length) return null;
          return (
            <View key={muscle} style={styles.muscleGroup}>
              <Text style={styles.muscleLabel}>{muscle}</Text>
              {group.map(ex => {
                const on = sel.includes(ex.id);
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[styles.exBtn, on && styles.exBtnOn]}
                    onPress={() => toggle(ex.id)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.exBtnName, on && styles.exBtnNameOn]}>{ex.name}</Text>
                      <Text style={[styles.exBtnType, on && styles.exBtnTypeOn]}>{ex.type}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.diffBadge, { backgroundColor: on ? 'rgba(255,255,255,0.2)' : diffBg(ex.difficulty) }]}>
                        <Text style={[styles.diffText, { color: on ? '#fff' : diffColor(ex.difficulty) }]}>{ex.difficulty}</Text>
                      </View>
                      {on && <Text style={{ color: '#fff', fontSize: 16 }}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        <TouchableOpacity
          style={[styles.saveBtn, (!name.trim() || !sel.length) && { opacity: 0.5 }]}
          onPress={save}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>Save Routine ({sel.length} exercises)</Text>
        </TouchableOpacity>
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

/* ─── Routine Card ─── */
function RoutineCard({ routine, onStart, onDelete, isAI }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [confirming, setConfirming] = useState(false);
  const exs = resolveExercises(routine);

  return (
    <View style={[styles.card, isAI && styles.aiCard]}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <View style={[styles.colorDot, { backgroundColor: routine.color || '#ff4d00' }]} />
          <Text style={styles.cardName} numberOfLines={1}>{routine.name}</Text>
          {isAI && <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI</Text></View>}
        </View>
        <Text style={styles.cardDuration}>{routine.duration}m</Text>
      </View>

      <View style={styles.tagRow}>
        {(isAI ? routine.exercises : exs).slice(0, 6).map((ex, i) => (
          <View key={i} style={[styles.tag, isAI && styles.tagAI]}>
            <Text style={[styles.tagText, isAI && styles.tagTextAI]} numberOfLines={1}>
              {isAI ? `${ex.name} ${ex.sets}×${ex.reps}` : ex.name}
            </Text>
          </View>
        ))}
        {exs.length > 6 && (
          <View style={styles.tag}><Text style={styles.tagText}>+{exs.length - 6} more</Text></View>
        )}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.startBtn} onPress={() => onStart(routine)} activeOpacity={0.85}>
          <Text style={styles.startBtnText}>▶ Preview & Start</Text>
        </TouchableOpacity>
        {confirming ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={styles.deleteConfirmBtn} onPress={() => { onDelete(routine.id); setConfirming(false); }}>
              <Text style={styles.deleteConfirmText}>Yes, delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirming(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.deleteBtn} onPress={() => setConfirming(true)}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

/* ─── Main Screen ─── */
export default function RoutinesScreen() {
  const navigation  = useNavigation();
  const { routines, addRoutine, setRoutines } = useStore();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [creating, setCreating] = useState(false);

  const allRoutines  = [...SAMPLE_ROUTINES, ...routines];
  const aiRoutines   = allRoutines.filter(r => r.generated);
  const myRoutines   = allRoutines.filter(r => !r.generated);

  const handleStart = routine => {
    navigation.navigate('Track', { startRoutine: routine });
  };

  const handleSave = routine => {
    addRoutine(routine);
    setCreating(false);
  };

  const handleDelete = id => {
    setRoutines(routines.filter(r => r.id !== id));
  };

  if (creating) {
    return <CreateRoutine onSave={handleSave} onBack={() => setCreating(false)} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Workouts</Text>
            <Text style={styles.pageSub}>{routines.length} saved routines</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.newBtn} onPress={() => setCreating(true)} activeOpacity={0.85}>
              <Text style={styles.newBtnText}>+ New</Text>
            </TouchableOpacity>
            <HeaderActions />
          </View>
        </View>

        {/* Quick Start Track Card */}
        <TouchableOpacity
          style={styles.quickStartCard}
          onPress={() => navigation.navigate('Track')}
          activeOpacity={0.85}
        >
          <View style={styles.quickStartIconWrap}>
            <Text style={{ fontSize: 24 }}>▶</Text>
          </View>
          <View style={styles.quickStartInfo}>
            <Text style={styles.quickStartTitle}>Start a Workout</Text>
            <Text style={styles.quickStartSub}>Track a new session, run, or cardio</Text>
          </View>
          <Text style={styles.quickStartChevron}>›</Text>
        </TouchableOpacity>

        {aiRoutines.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <View style={styles.sectionHeader}>
              <Text style={{ fontSize: 16 }}>✨</Text>
              <Text style={styles.sectionTitle}>AI Generated For You</Text>
              <View style={styles.personalBadge}>
                <Text style={styles.personalBadgeText}>PERSONALISED</Text>
              </View>
            </View>
            {aiRoutines.map(r => (
              <RoutineCard key={r.id} routine={r} onStart={handleStart} onDelete={handleDelete} isAI />
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>My Custom Routines</Text>
        {myRoutines.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyEmoji}>💪</Text>
            <Text style={styles.emptyTitle}>No custom routines yet</Text>
            <Text style={styles.emptySub}>Build your own routine from our exercise library</Text>
            <TouchableOpacity style={styles.saveBtn} onPress={() => setCreating(true)} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>+ Create Routine</Text>
            </TouchableOpacity>
          </View>
        ) : (
          myRoutines.map(r => (
            <RoutineCard key={r.id} routine={r} onStart={handleStart} onDelete={handleDelete} isAI={false} />
          ))
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },
  scroll:         { paddingHorizontal: 16, paddingBottom: 32 },

  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 20, paddingBottom: 20 },
  headerRight:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageTitle:      { fontSize: 34, fontWeight: '900', color: colors.text },
  pageSub:        { fontSize: 14, color: colors.text2, marginTop: 2 },
  newBtn:         { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  newBtnText:     { color: '#fff', fontSize: 13, fontWeight: '700' },

  quickStartCard:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.text, borderRadius: 18, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  quickStartIconWrap:  { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,77,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  quickStartInfo:      { flex: 1 },
  quickStartTitle:     { fontSize: 16, fontWeight: '800', color: colors.bg },
  quickStartSub:       { fontSize: 12, color: 'rgba(150,150,150,0.9)', marginTop: 2 },
  quickStartChevron:   { fontSize: 26, color: '#888' },

  sectionHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle:   { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 12 },
  personalBadge:  { backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  personalBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },

  card:           { backgroundColor: colors.surface, borderRadius: 18, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  aiCard:         { borderColor: colors.accent, borderWidth: 2, backgroundColor: colors.accentDim },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  colorDot:       { width: 10, height: 10, borderRadius: 5 },
  cardName:       { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
  cardDuration:   { fontSize: 12, color: colors.text2 },
  aiBadge:        { backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  aiBadgeText:    { fontSize: 10, color: '#fff', fontWeight: '700' },

  tagRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  tag:            { backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  tagAI:          { backgroundColor: colors.accentDim },
  tagText:        { fontSize: 12, color: colors.text2 },
  tagTextAI:      { color: colors.accent, fontWeight: '600' },

  cardActions:    { flexDirection: 'row', gap: 8 },
  startBtn:       { flex: 1, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  startBtnText:   { color: '#fff', fontSize: 14, fontWeight: '700' },
  deleteBtn:      { backgroundColor: '#fef2f2', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13 },
  deleteBtnText:  { color: colors.red, fontSize: 13, fontWeight: '700' },
  deleteConfirmBtn: { backgroundColor: colors.red, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 13 },
  deleteConfirmText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cancelBtn:      { backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 13 },
  cancelText:     { color: colors.text2, fontSize: 12, fontWeight: '600' },

  emptyCard:      { alignItems: 'center', paddingVertical: 28 },
  emptyEmoji:     { fontSize: 32, marginBottom: 8 },
  emptyTitle:     { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 },
  emptySub:       { fontSize: 13, color: colors.text2, textAlign: 'center', marginBottom: 16 },

  createHeader:   { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, padding: 16, paddingTop: 56 },
  backBtn:        { marginBottom: 8 },
  backText:       { fontSize: 15, fontWeight: '600', color: colors.text2 },
  createTitle:    { fontSize: 22, fontWeight: '900', color: colors.text },
  nameInput:      { backgroundColor: colors.surface, borderRadius: 14, padding: 16, fontSize: 16, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: 20 },
  selectLabel:    { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 },
  muscleGroup:    { marginBottom: 20 },
  muscleLabel:    { fontSize: 11, fontWeight: '700', color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  exBtn:          { backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 2, borderColor: colors.border, marginBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 54 },
  exBtnOn:        { backgroundColor: colors.accent, borderColor: colors.accent },
  exBtnName:      { fontSize: 14, fontWeight: '600', color: colors.text },
  exBtnNameOn:    { color: '#fff' },
  exBtnType:      { fontSize: 11, color: colors.text3, marginTop: 2 },
  exBtnTypeOn:    { color: 'rgba(255,255,255,0.7)' },
  diffBadge:      { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  diffText:       { fontSize: 10, fontWeight: '600' },
  saveBtn:        { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  saveBtnText:    { color: '#fff', fontSize: 15, fontWeight: '700' },
});
