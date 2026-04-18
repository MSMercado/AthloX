import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Modal, Image, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import useStore from '../store/useStore';
import useColors from '../lib/useColors';
import { shadow } from '../lib/theme';
import { getLevelInfo } from '../lib/xp';

const { width } = Dimensions.get('window');

const DAY_ABBR    = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_ORDER   = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function parseISODate(iso) {
  if (!iso) return new Date(NaN);
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getMondayWeek() {
  const today = new Date();
  const dow = today.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      label:   DAY_ABBR[d.getDay()],
      date:    d.getDate(),
      month:   d.getMonth(),
      year:    d.getFullYear(),
      isToday: d.toDateString() === today.toDateString(),
      key:     `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
    };
  });
}

function buildLogSet(logs) {
  const s = new Set();
  logs.forEach(log => {
    const d = new Date(log.ts || log.date || log.id);
    if (!isNaN(d)) s.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  });
  return s;
}

// Build a map of calKey → { dayData, dayDate } for the entire workout plan
function buildPlanScheduleMap(workoutPlan) {
  if (!workoutPlan?.weeklySchedule || !workoutPlan?.startDate) return new Map();
  const planStart  = new Date(workoutPlan.startDate);
  const totalWeeks = workoutPlan.durationWeeks || 12;
  const result     = new Map();
  for (let week = 0; week < totalWeeks; week++) {
    const weekStart = getMondayOfWeek(addDays(planStart, week * 7));
    DAY_ORDER.forEach((dayName, i) => {
      const dayData = workoutPlan.weeklySchedule.find(d => d.day === dayName);
      if (!dayData || dayData.type === 'rest') return;
      const date = addDays(weekStart, i);
      date.setHours(0, 0, 0, 0);
      const calKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      result.set(calKey, { dayData, dayDate: new Date(date) });
    });
  }
  return result;
}

// Convert 'YYYY-MM-DD' to calKey format: 'YYYY-M-D' (0-indexed month, no padding)
function isoToCalKey(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}-${m - 1}-${d}`;
}

function todayISO() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

const getGreeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night';
};

// ── Workout Info Sheet ─────────────────────────────────────────────────────────
// Bottom sheet shown when user taps a scheduled day in WeekStrip or Calendar

function WorkoutInfoSheet({ visible, entry, onClose, onStart }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!entry) return null;

  const { dayData, dayDate } = entry;
  const isCoachItem = !!dayData.isCoachItem;
  const isCardio    = dayData.type === 'cardio';
  const accentCol   = isCardio ? colors.green : colors.accent;
  const exercises   = dayData.exercises || [];
  const dateLabel   = dayDate
    ? dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : '';
  const estMins = isCoachItem
    ? (dayData.duration || 30)
    : exercises.length > 0 ? exercises.length * 8 : 30;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.infoSheet, { backgroundColor: colors.surface }]}>
          {/* Accent bar */}
          <View style={[styles.infoAccentBar, { backgroundColor: accentCol }]} />
          {/* Handle */}
          <View style={[styles.infoHandle, { backgroundColor: colors.border }]} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            {/* Header */}
            <View style={styles.infoHeader}>
              <Text style={[styles.infoDate, { color: colors.text3 }]}>{dateLabel.toUpperCase()}</Text>
              <Text style={[styles.infoTitle, { color: colors.text }]}>
                {dayData.focus || 'Workout'}
              </Text>
              {/* Pills */}
              <View style={styles.infoPillRow}>
                <View style={[styles.infoPill, { backgroundColor: accentCol + '22', borderColor: accentCol + '55' }]}>
                  <Text style={[styles.infoPillText, { color: accentCol }]}>
                    {isCoachItem ? '✨ Coach' : isCardio ? '🏃 Cardio' : '💪 Strength'}
                  </Text>
                </View>
                <View style={[styles.infoPill, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                  <Text style={[styles.infoPillText, { color: colors.text2 }]}>~{estMins} min</Text>
                </View>
                {exercises.length > 0 && (
                  <View style={[styles.infoPill, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <Text style={[styles.infoPillText, { color: colors.text2 }]}>{exercises.length} exercises</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Exercises or coach note */}
            {exercises.length > 0 ? (
              <View style={{ paddingHorizontal: 20 }}>
                <Text style={[styles.infoSectionLabel, { color: colors.text3 }]}>EXERCISES</Text>
                {exercises.map((ex, i) => (
                  <View key={i} style={[styles.infoExCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                    <View style={[styles.infoExNum, { backgroundColor: accentCol + '22' }]}>
                      <Text style={[styles.infoExNumText, { color: accentCol }]}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.infoExName, { color: colors.text }]}>{ex.name}</Text>
                      <View style={styles.infoChipRow}>
                        {[
                          { label: 'SETS', val: ex.sets },
                          { label: 'REPS', val: ex.reps },
                          { label: 'REST', val: ex.rest },
                        ].map(chip => (
                          <View key={chip.label} style={[styles.infoChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            <Text style={[styles.infoChipLabel, { color: colors.text3 }]}>{chip.label}</Text>
                            <Text style={[styles.infoChipVal, { color: colors.text }]}>{chip.val}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.infoCoachNote, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                <Text style={{ fontSize: 32, marginBottom: 10 }}>✨</Text>
                <Text style={[styles.infoCoachNoteText, { color: colors.text2 }]}>
                  Your coach scheduled this session. Start it to choose your exercises and track your progress.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Start Workout button */}
          <View style={[styles.infoFooter, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.infoStartBtn, { backgroundColor: accentCol }]}
              onPress={onStart}
              activeOpacity={0.85}
            >
              <Text style={styles.infoStartBtnText}>▶  Start Workout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Week Strip ────────────────────────────────────────────────────────────────
function WeekStrip({ weekDays, logSet, scheduleSet, allScheduleMap, onDayPress }) {
  const colors = useColors();
  return (
    <View style={[ws.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      {weekDays.map((day, i) => {
        const hasLog   = logSet.has(day.key);
        const hasSched = scheduleSet?.has(day.key) && !hasLog;
        const tappable = hasSched && allScheduleMap?.has(day.key);
        const showBar  = hasLog || hasSched;

        const inner = (
          <View style={ws.col}>
            <Text style={[ws.label, { color: day.isToday ? colors.accent : colors.text3 }]}>
              {day.label}
            </Text>
            {/* Date circle — only filled for today, no border changes for scheduled */}
            <View style={[ws.circle, day.isToday && { backgroundColor: colors.accent }]}>
              <Text style={[
                ws.num,
                { color: day.isToday ? '#fff' : colors.text2 },
                day.isToday && { fontWeight: '800' },
              ]}>
                {day.date}
              </Text>
            </View>
            {/* Underline bar: accent for logged/scheduled, transparent otherwise */}
            <View style={[ws.bar, { backgroundColor: showBar ? colors.accent : 'transparent' }]} />
          </View>
        );

        if (tappable) {
          return (
            <TouchableOpacity
              key={i}
              style={ws.colWrap}
              activeOpacity={0.7}
              onPress={() => onDayPress(allScheduleMap.get(day.key))}
            >
              {inner}
            </TouchableOpacity>
          );
        }
        return <View key={i} style={ws.colWrap}>{inner}</View>;
      })}
    </View>
  );
}

const ws = StyleSheet.create({
  container: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1 },
  colWrap:   { flex: 1 },
  col:       { alignItems: 'center', gap: 5 },
  label:     { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  circle:    { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  num:       { fontSize: 15, fontWeight: '600' },
  bar:       { height: 3, width: 22, borderRadius: 2 },
});

// ── Calendar Modal ────────────────────────────────────────────────────────────
function CalendarModal({ visible, onClose, logSet, scheduleSet = new Set(), allScheduleMap, onDayPress }) {
  const colors = useColors();
  const today  = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const daysInMonth    = getDaysInMonth(year, month);
  const firstDayOffset = getFirstDayOfMonth(year, month);
  const cells = Array.from({ length: firstDayOffset }, () => null)
    .concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={cm.overlay}>
        <TouchableOpacity style={cm.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[cm.sheet, { backgroundColor: colors.surface }]}>
          <View style={[cm.handle, { backgroundColor: colors.border }]} />

          {/* Month nav */}
          <View style={cm.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={cm.navBtn} activeOpacity={0.7}>
              <Text style={[cm.navArrow, { color: colors.text }]}>‹</Text>
            </TouchableOpacity>
            <Text style={[cm.monthTitle, { color: colors.text }]}>
              {MONTH_NAMES[month]} {year}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={cm.navBtn} activeOpacity={0.7}>
              <Text style={[cm.navArrow, { color: colors.text }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={cm.dayHeaders}>
            {['MON','TUE','WED','THU','FRI','SAT','SUN'].map(d => (
              <Text key={d} style={[cm.dayHeader, { color: colors.text3 }]}>{d}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={cm.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`e-${i}`} style={cm.cell} />;
              const calKey    = `${year}-${month}-${day}`;
              const isToday   = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const hasLog    = logSet.has(calKey);
              const hasSchedl = scheduleSet.has(calKey) && !hasLog;
              const tappable  = hasSchedl && allScheduleMap?.has(calKey);

              const inner = (
                <View style={[
                  cm.dayCel,
                  isToday    && { backgroundColor: colors.text },
                  !isToday   && hasLog     && { backgroundColor: colors.accent + '22', borderWidth: 1, borderColor: colors.accent + '55' },
                  !isToday   && hasSchedl  && { backgroundColor: colors.accent + '22', borderWidth: 1, borderColor: colors.accent + '55' },
                ]}>
                  <Text style={[
                    cm.dayNum,
                    { color: isToday ? colors.bg : hasLog || hasSchedl ? colors.accent : colors.text2 },
                    isToday && { fontWeight: '800' },
                  ]}>
                    {day}
                  </Text>
                </View>
              );

              return (
                <View key={`d-${i}`} style={cm.cell}>
                  {tappable ? (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => { onDayPress(allScheduleMap.get(calKey)); }}
                    >
                      {inner}
                    </TouchableOpacity>
                  ) : inner}
                  {(hasLog || hasSchedl) && !isToday && <View style={[cm.logDot, { backgroundColor: colors.accent }]} />}
                </View>
              );
            })}
          </View>

          {/* Legend */}
          <View style={cm.legend}>
            <View style={cm.legendItem}>
              <View style={[cm.legendDot, { backgroundColor: colors.accent }]} />
              <Text style={[cm.legendText, { color: colors.text2 }]}>Logged / Scheduled</Text>
            </View>
            <View style={cm.legendItem}>
              <View style={[cm.legendCircle, { backgroundColor: colors.accent }]} />
              <Text style={[cm.legendText, { color: colors.text2 }]}>Today</Text>
            </View>
          </View>

          <View style={cm.calFooterNote}>
            <Text style={[cm.calFooterText, { color: colors.text3 }]}>
              Tap a highlighted date to see workout details
            </Text>
          </View>

          <TouchableOpacity style={[cm.closeBtn, { backgroundColor: colors.accent }]} onPress={onClose} activeOpacity={0.85}>
            <Text style={cm.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay:     { flex: 1, justifyContent: 'flex-end' },
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:       { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12 },
  handle:      { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  monthNav:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  navBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navArrow:    { fontSize: 28, fontWeight: '300' },
  monthTitle:  { fontSize: 20, fontWeight: '800' },
  dayHeaders:  { flexDirection: 'row', marginBottom: 6 },
  dayHeader:   { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap' },
  cell:        { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 },
  dayCel:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayNum:      { fontSize: 14, fontWeight: '600' },
  logDot:      { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  legend:      { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 16, marginBottom: 8 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendCircle:{ width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  legendText:  { fontSize: 12 },
  calFooterNote:{ alignItems: 'center', marginBottom: 14 },
  calFooterText:{ fontSize: 12 },
  closeBtn:    { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
});

// ── Weekly bar chart ──────────────────────────────────────────────────────────
function getWeeklyChart(logs) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    const cal = logs
      .filter(l => l.ts >= d.getTime() && l.ts <= end.getTime())
      .reduce((s, l) => s + (l.calories || 0), 0);
    return { day: i === 6 ? 'Today' : days[d.getDay()], calories: cal, isToday: i === 6 };
  });
}

function WeeklyChart({ chart }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const maxCal = Math.max(...chart.map(d => d.calories), 1);
  const chartH = 68;
  const empty  = chart.every(d => d.calories === 0);

  return (
    <View style={[styles.card, { marginBottom: 14 }]}>
      <Text style={styles.sectionTitle}>This Week</Text>
      {empty ? (
        <Text style={styles.emptyChartText}>Complete a workout to see your chart</Text>
      ) : (
        <View style={styles.chartRow}>
          {chart.map((d, i) => (
            <View key={i} style={styles.chartCol}>
              <View style={[styles.bar, { height: Math.max((d.calories / maxCal) * chartH, 4), backgroundColor: d.isToday ? colors.accent : d.calories > 0 ? colors.text : colors.border }]} />
              <Text style={[styles.barLabel, d.isToday && { color: colors.accent, fontWeight: '700' }]}>{d.day}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function LogRow({ log }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isCardio = log.type === 'cardio';
  return (
    <View style={[styles.card, styles.logRow]}>
      <View style={[styles.logIcon, { backgroundColor: isCardio ? '#ecfdf5' : colors.accentDim }]}>
        <Text style={{ fontSize: 20 }}>{isCardio ? '🏃' : '💪'}</Text>
      </View>
      <View style={styles.logInfo}>
        <Text style={styles.logName} numberOfLines={1}>{log.routine}</Text>
        <Text style={styles.logMeta}>{log.duration}min · {log.calories} cal{log.distance ? ` · ${log.distance}km` : ''}</Text>
      </View>
      <Text style={styles.logDate}>{log.date}</Text>
    </View>
  );
}

// ── Today's Workout Card ──────────────────────────────────────────────────────
function TodayWorkoutCard({ workout, onPress, onStart }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <TouchableOpacity style={styles.todayCard} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.todayCardTop}>
        <View style={styles.todayIconWrap}>
          <Text style={{ fontSize: 13, fontWeight: '900', color: colors.accent }}>TODAY</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.todayCardLabel}>Today's Scheduled Workout</Text>
          <Text style={styles.todayCardTitle}>{workout.focus || workout.title || 'Workout'}</Text>
          <Text style={styles.todayCardMeta}>
            {workout.isCoachItem
              ? `~${workout.duration || 30} min · Added by AI Coach`
              : `~${(workout.exercises?.length || 0) * 8 || 30} min · From your training plan`}
          </Text>
        </View>
        <Text style={{ color: colors.accent, fontSize: 20, fontWeight: '300' }}>›</Text>
      </View>
      <TouchableOpacity style={styles.todayCardBtn} onPress={onStart} activeOpacity={0.85}>
        <Text style={styles.todayCardBtnText}>▶ Start Workout</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const navigation = useNavigation();
  const { user, logs, scheduledWorkouts, workoutPlan } = useStore();
  const colors  = useColors();
  const styles  = useMemo(() => makeStyles(colors), [colors]);

  const [showCal,      setShowCal]      = useState(false);
  const [detailEntry,  setDetailEntry]  = useState(null); // { dayData, dayDate }

  const chart    = useMemo(() => getWeeklyChart(logs), [logs]);
  const weekDays = useMemo(() => getMondayWeek(), []);
  const logSet   = useMemo(() => buildLogSet(logs), [logs]);

  // Build plan schedule map (covers all weeks of the full plan)
  const planScheduleMap = useMemo(() => buildPlanScheduleMap(workoutPlan), [workoutPlan]);

  // Build unified schedule map: plan workouts + coach workouts
  const allScheduleMap = useMemo(() => {
    const map = new Map(planScheduleMap); // copy plan entries
    (scheduledWorkouts || []).forEach(w => {
      const key = isoToCalKey(w.date);
      if (!map.has(key)) {
        // Coach item — convert to dayData shape
        map.set(key, {
          dayData: {
            type:        'workout',
            focus:       w.title,
            exercises:   [],
            isCoachItem: true,
            duration:    w.duration,
          },
          dayDate: parseISODate(w.date),
        });
      }
    });
    return map;
  }, [planScheduleMap, scheduledWorkouts]);

  // Set of calKeys for the schedule indicators
  const scheduleSet = useMemo(() => new Set(allScheduleMap.keys()), [allScheduleMap]);

  // Today's workout: check plan first, then coach schedule
  const todayWorkout = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const entry = allScheduleMap.get(todayKey);
    return entry?.dayData || null;
  }, [allScheduleMap]);

  const weekStart  = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d.getTime();
  }, []);

  const weekLogs   = logs.filter(l => l.ts >= weekStart);
  const totalCal   = weekLogs.reduce((s, l) => s + (l.calories || 0), 0);
  const totalMin   = weekLogs.reduce((s, l) => s + (l.duration || 0), 0);
  const weekCount  = weekLogs.length;
  const streak     = user?.streak || 0;
  const firstName  = user?.user_metadata?.display_name || (user?.user_metadata?.full_name || user?.name || 'Athlete').split(' ')[0];
  const xp         = useStore(s => s.xp);
  const levelInfo  = getLevelInfo(xp);
  const goal       = user?.user_metadata?.goals?.[0] || user?.goals?.[0] || user?.goal || null;
  const initials   = getInitials(user?.user_metadata?.full_name || user?.name || '');
  const avatarUrl  = user?.user_metadata?.avatar_url || null;

  const stats = [
    { value: totalCal.toLocaleString(), label: 'Cal this week', bg: colors.accentDim, col: colors.accent },
    { value: totalMin,                  label: 'Min this week',  bg: '#eff6ff',        col: colors.blue  },
    { value: weekCount,                 label: 'Sessions',       bg: '#f0fdf4',        col: colors.green },
  ];

  const openDayDetail = (entry) => {
    setDetailEntry(entry);
    if (showCal) setShowCal(false); // close calendar before showing detail
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Top Bar ── */}
      <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.topLeft}>
          <TouchableOpacity
            style={[styles.avatarWrap, { borderColor: colors.accent + '55' }]}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.8}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatarInner, { backgroundColor: colors.accent }]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Social')}
            activeOpacity={0.7}
          >
            <Text style={styles.iconBtnText}>›</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.brandName, { color: colors.text }]}>AthloX</Text>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
          onPress={() => setShowCal(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.iconBtnText}>▦</Text>
        </TouchableOpacity>
      </View>

      {/* ── Week Strip ── */}
      <WeekStrip
        weekDays={weekDays}
        logSet={logSet}
        scheduleSet={scheduleSet}
        allScheduleMap={allScheduleMap}
        onDayPress={openDayDetail}
      />

      {/* ── Scrollable Content ── */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.greetRow}>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <View style={styles.heroNameRow}>
            <Text style={styles.heroName}>{firstName}</Text>
            <View style={[styles.levelBadge, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '33' }]}>
              <Text style={styles.levelBadgeText}>{levelInfo.current.emoji}</Text>
              <Text style={[styles.levelBadgeLabel, { color: colors.accent }]}>Lv.{levelInfo.current.level} {levelInfo.current.title}</Text>
            </View>
          </View>
        </View>

        {todayWorkout && (
          <TodayWorkoutCard
            workout={todayWorkout}
            onPress={() => {
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
              openDayDetail(allScheduleMap.get(todayKey));
            }}
            onStart={() => navigation.navigate('Workout')}
          />
        )}

        <View style={styles.streakCard}>
          <View style={styles.streakCircle} />
          <View style={styles.streakRow}>
            <View style={styles.streakNumBlock}>
              <Text style={styles.streakNum}>{streak}</Text>
              <Text style={styles.streakNumLabel}>days</Text>
            </View>
            <View style={styles.streakInfo}>
              <Text style={styles.streakCount}>{streak > 0 ? 'CURRENT STREAK' : 'START YOUR STREAK'}</Text>
              <Text style={styles.streakSub}>
                {streak === 0 ? "Log your first workout to start" : "You're on a roll — don't stop now!"}
              </Text>
            </View>
            {goal && (
              <View style={styles.goalBadge}>
                <Text style={styles.goalLabel}>Goal</Text>
                <Text style={styles.goalText} numberOfLines={2}>{goal.replace(/[^\w\s]/g, '').trim()}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.statsRow}>
          {stats.map(s => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
              <Text style={[styles.statValue, { color: s.col }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <WeeklyChart chart={chart} />

        <TouchableOpacity style={styles.coachCard} onPress={() => navigation.navigate('Coach')} activeOpacity={0.85}>
          <View style={[styles.coachIcon, { backgroundColor: colors.accent }]}>
            <Text style={styles.coachIconText}>AI</Text>
          </View>
          <View style={styles.coachInfo}>
            <Text style={styles.coachTitle}>Chat with your AI Coach</Text>
            <Text style={styles.coachSub}>Personalised advice tailored to you</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.progressCard} onPress={() => navigation.navigate('Progress')} activeOpacity={0.85}>
          <View style={[styles.coachIcon, { backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent + '33' }]}>
            <Text style={[styles.coachIconText, { color: colors.accent }]}>+</Text>
          </View>
          <View style={styles.coachInfo}>
            <Text style={[styles.coachTitle, { color: colors.text }]}>View Progress & Stats</Text>
            <Text style={[styles.coachSub, { color: colors.text2 }]}>Charts, streaks, personal bests</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </View>

        {logs.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <View style={styles.emptyAccentLine} />
            <Text style={styles.emptyTitle}>No workouts yet</Text>
            <Text style={styles.emptySub}>Head to the Workout tab to log your first session</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Workout')} activeOpacity={0.85}>
              <Text style={styles.emptyBtnText}>Start Workout →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          logs.slice(0, 5).map(log => <LogRow key={log.id} log={log} />)
        )}
      </ScrollView>

      {/* ── Calendar Modal ── */}
      <CalendarModal
        visible={showCal}
        onClose={() => setShowCal(false)}
        logSet={logSet}
        scheduleSet={scheduleSet}
        allScheduleMap={allScheduleMap}
        onDayPress={openDayDetail}
      />

      {/* ── Workout Info Sheet ── */}
      <WorkoutInfoSheet
        visible={!!detailEntry}
        entry={detailEntry}
        onClose={() => setDetailEntry(null)}
        onStart={() => { setDetailEntry(null); navigation.navigate('Workout'); }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },
  scroll:         { paddingHorizontal: 16, paddingBottom: 32 },

  // ── Top bar ──
  topBar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  topLeft:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap:     { width: 40, height: 40, borderRadius: 20, borderWidth: 2, overflow: 'hidden' },
  avatarInner:    { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  avatarImg:      { width: '100%', height: '100%' },
  avatarInitials: { fontSize: 15, fontWeight: '800', color: '#fff' },
  iconBtn:        { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  iconBtnText:    { fontSize: 16, fontWeight: '700', color: colors.text2 },
  brandName:      { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },

  // ── Greeting ──
  greetRow:       { paddingTop: 18, paddingBottom: 8 },
  greeting:       { fontSize: 13, color: colors.text2 },
  heroNameRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  heroName:       { fontSize: 32, fontWeight: '900', color: colors.text, lineHeight: 36, marginTop: 2 },
  levelBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, marginTop: 4 },
  levelBadgeText: { fontSize: 14 },
  levelBadgeLabel:{ fontSize: 12, fontWeight: '800' },

  // ── Streak ──
  streakCard:     { borderRadius: 20, padding: 20, marginBottom: 14, overflow: 'hidden', backgroundColor: colors.accent, shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  streakCircle:   { position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)' },
  streakRow:      { flexDirection: 'row', alignItems: 'center', gap: 14 },
  streakNumBlock: { alignItems: 'center', minWidth: 52 },
  streakNum:      { fontSize: 40, fontWeight: '900', color: '#fff', lineHeight: 42 },
  streakNumLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 },
  streakInfo:     { flex: 1 },
  streakCount:    { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 1, textTransform: 'uppercase' },
  streakSub:      { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  goalBadge:      { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 10, alignItems: 'center', maxWidth: 80 },
  goalLabel:      { fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 },
  goalText:       { fontSize: 12, color: '#fff', fontWeight: '700', marginTop: 2, textAlign: 'center', lineHeight: 15 },

  // ── Stats ──
  statsRow:       { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard:       { flex: 1, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border },
  statValue:      { fontSize: 22, fontWeight: '900', lineHeight: 24 },
  statLabel:      { fontSize: 11, color: colors.text2, marginTop: 3 },

  // ── Cards ──
  card:           { backgroundColor: colors.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  sectionTitle:   { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 14 },
  emptyChartText: { fontSize: 13, color: colors.text3, textAlign: 'center', paddingVertical: 20 },
  chartRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 90 },
  chartCol:       { flex: 1, alignItems: 'center', gap: 4, justifyContent: 'flex-end' },
  bar:            { width: '100%', borderRadius: 5 },
  barLabel:       { fontSize: 9, color: colors.text3 },

  // ── Coach card ──
  coachCard:      { backgroundColor: colors.text, borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  progressCard:   { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  coachIcon:      { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  coachIconText:  { fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  coachInfo:      { flex: 1 },
  coachTitle:     { fontSize: 15, fontWeight: '700', color: colors.bg },
  coachSub:       { fontSize: 12, color: 'rgba(150,150,150,0.9)', marginTop: 2 },
  chevron:        { fontSize: 22, color: '#888', fontWeight: '300' },

  // ── Log rows ──
  recentHeader:   { marginBottom: 12 },
  logRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, padding: 14 },
  logIcon:        { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logInfo:        { flex: 1, minWidth: 0 },
  logName:        { fontSize: 14, fontWeight: '600', color: colors.text },
  logMeta:        { fontSize: 12, color: colors.text2, marginTop: 2 },
  logDate:        { fontSize: 11, color: colors.text3 },

  // ── Today's scheduled workout card ──
  todayCard:      { backgroundColor: colors.accentDim, borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.accent + '40' },
  todayCardTop:   { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12 },
  todayIconWrap:  { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accent + '22', alignItems: 'center', justifyContent: 'center' },
  todayCardLabel: { fontSize: 11, fontWeight: '700', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  todayCardTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 2 },
  todayCardMeta:  { fontSize: 12, color: colors.text2 },
  todayCardBtn:   { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  todayCardBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },

  // ── Empty state ──
  emptyCard:       { alignItems: 'center', paddingVertical: 28 },
  emptyAccentLine: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.accent, marginBottom: 14 },
  emptyTitle:      { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 6 },
  emptySub:       { fontSize: 13, color: colors.text2, marginBottom: 16 },
  emptyBtn:       { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  emptyBtnText:   { color: '#fff', fontWeight: '700', fontSize: 14 },

  // ── Workout info sheet ──
  sheetOverlay:   { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  infoSheet:      { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%' },
  infoAccentBar:  { height: 4, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  infoHandle:     { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  infoHeader:     { padding: 20, paddingBottom: 12 },
  infoDate:       { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6, textTransform: 'uppercase' },
  infoTitle:      { fontSize: 26, fontWeight: '900', lineHeight: 30, marginBottom: 12 },
  infoPillRow:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  infoPill:       { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  infoPillText:   { fontSize: 12, fontWeight: '700' },
  infoSectionLabel:{ fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 12, marginTop: 8 },
  infoExCard:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 8 },
  infoExNum:      { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoExNumText:  { fontSize: 13, fontWeight: '900' },
  infoExName:     { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  infoChipRow:    { flexDirection: 'row', gap: 6 },
  infoChip:       { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, alignItems: 'center', minWidth: 52 },
  infoChipLabel:  { fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  infoChipVal:    { fontSize: 13, fontWeight: '800' },
  infoCoachNote:  { margin: 20, borderRadius: 18, padding: 24, borderWidth: 1, alignItems: 'center' },
  infoCoachNoteText:{ fontSize: 14, lineHeight: 22, textAlign: 'center' },
  infoFooter:     { padding: 16, paddingBottom: 32, borderTopWidth: 1 },
  infoStartBtn:   { borderRadius: 16, paddingVertical: 17, alignItems: 'center', elevation: 4 },
  infoStartBtnText:{ color: '#fff', fontSize: 17, fontWeight: '800' },
});
