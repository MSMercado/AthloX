import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useStore from '../store/useStore';
import useColors from '../lib/useColors';
import { shadow } from '../lib/theme';
import HeaderActions from '../components/HeaderActions';

// ── Groq API ─────────────────────────────────────────────────────────────────
const GROQ_KEY  = process.env.EXPO_PUBLIC_GROQ_KEY;
const GROQ_URL  = 'https://api.groq.com/openai/v1/chat/completions';

const QUICK_SUGGESTIONS = [
  { icon: '💪', text: 'Give me a workout plan for this week' },
  { icon: '🍎', text: 'What should I eat before working out?' },
  { icon: '😴', text: 'How much rest do I need between sessions?' },
  { icon: '📈', text: 'How do I break through a plateau?' },
  { icon: '🔥', text: 'Best exercises to burn fat fast?' },
  { icon: '🧘', text: 'Help me with recovery and stretching' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatScheduleDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Detect if a response looks like a multi-day workout plan
function looksLikePlan(text) {
  const lower = text.toLowerCase();
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const dayCount = days.filter(d => lower.includes(d)).length;
  const hasPlanWords = /\b(plan|week|schedule|routine|session|training day)\b/i.test(text);
  return dayCount >= 2 && hasPlanWords;
}

// Second focused API call: extract structured schedule from readable plan text
async function extractScheduleFromText(planText, tomorrow) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{
        role: 'user',
        content: `You are a JSON extractor. Extract the workout days from the fitness plan below into a JSON array. Rules:
- Skip rest days
- Start real calendar dates from ${tomorrow} (YYYY-MM-DD format, one date per workout day in order)
- Keep title very short: 2-3 words max
- duration is a number (estimated minutes, default 30 if unclear)
- Respond with ONLY the raw JSON array, nothing else, no markdown

Format: [{"date":"YYYY-MM-DD","title":"Short Name","duration":30}]

Plan:
${planText.slice(0, 1500)}`,
      }],
      max_tokens: 400,
      temperature: 0,
    }),
  });
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content?.trim() || '[]';
  const cleaned = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```$/i,'').trim();
  let arr;
  try {
    arr = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr
    .filter(d => d.date && d.title)
    .map((d, i) => ({
      id:       `sched_${Date.now()}_${i}`,
      date:     d.date,
      title:    d.title,
      duration: typeof d.duration === 'number' ? d.duration : 30,
    }));
}

// ── Typing Dots ───────────────────────────────────────────────────────────────

function TypingDots() {
  const colors = useColors();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 200);
    const a3 = anim(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  const dotStyle = (dot) => ({
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: colors.text3, marginHorizontal: 2,
    opacity: dot,
    transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 14, borderBottomLeftRadius: 4 }}>
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isUser = msg.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={styles.coachAvatar}>
          <Text style={styles.coachAvatarText}>✨</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleCoach]}>
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {msg.content}
        </Text>
      </View>
    </View>
  );
}

// ── Calendar Action Card ──────────────────────────────────────────────────────

function CalendarCard({ onAccept, onDecline }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.bubbleRow, { alignItems: 'flex-start' }]}>
      <View style={styles.coachAvatar}>
        <Text style={styles.coachAvatarText}>✨</Text>
      </View>
      <View style={styles.calCard}>
        <Text style={styles.calCardTitle}>📅 Add to your calendar?</Text>
        <Text style={styles.calCardSub}>
          I can schedule these workouts in your Plan tab and Today tab so you never miss a session.
        </Text>
        <View style={styles.calBtns}>
          <TouchableOpacity style={[styles.calBtn, { backgroundColor: colors.accent }]} onPress={onAccept} activeOpacity={0.85}>
            <Text style={styles.calBtnYes}>Yes, add it! 📅</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.calBtn, styles.calBtnNo]} onPress={onDecline} activeOpacity={0.85}>
            <Text style={[styles.calBtnNoText, { color: colors.text2 }]}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Coach Screen ──────────────────────────────────────────────────────────────

export default function CoachScreen() {
  const { user, logs, setScheduledWorkouts } = useStore();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [pendingSchedule, setPendingSchedule] = useState(null);
  const scrollRef = useRef(null);

  const userName     = user?.name || user?.user_metadata?.full_name?.split(' ')[0] || 'there';
  const goals        = user?.user_metadata?.goals || (user?.goal ? [user.goal] : []);
  const level        = user?.level || user?.user_metadata?.level || 'beginner';
  const totalWorkouts = logs.length;

  const welcomeMsg = {
    role: 'assistant',
    content: `Hey ${userName}! 👋 I'm your AI fitness coach.\n\nI know you're working on: ${goals.length ? goals.join(', ') : 'your fitness journey'}. With ${totalWorkouts} workout${totalWorkouts !== 1 ? 's' : ''} logged, you're building great habits!\n\nWhat can I help you with today?`,
  };

  const visibleMessages    = messages.length === 0 ? [welcomeMsg] : messages;
  const showQuickSuggestions = messages.length === 0;

  const buildSystemPrompt = () => {
    return `You are a knowledgeable, friendly, and motivating personal fitness coach inside the AthloX fitness app.

User profile:
- Name: ${userName}
- Fitness level: ${level}
- Goals: ${goals.join(', ') || 'general fitness'}
- Total workouts logged: ${totalWorkouts}

Keep responses concise, practical, and encouraging. Use emojis sparingly. Format lists with line breaks. Never recommend seeing a doctor unless medically necessary.

When creating a multi-day workout plan or weekly routine, always name the days clearly (e.g. Monday, Tuesday) and include the workout focus for each day.`;
  };

  const sendMessage = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');
    setPendingSchedule(null);

    const userMsg = { role: 'user', content };
    const history = messages.length === 0
      ? [{ role: 'assistant', content: welcomeMsg.content }, userMsg]
      : [...messages, userMsg];

    setMessages(history);
    setLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model:       'llama-3.1-8b-instant',
          messages:    [
            { role: 'system', content: buildSystemPrompt() },
            ...history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
          ],
          max_tokens:  700,
          temperature: 0.7,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

      const rawReply = data?.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't process that. Try again!";

      const newMessages = [...history, { role: 'assistant', content: rawReply }];
      setMessages(newMessages);

      // Detect if this response is a multi-day plan and show calendar card
      if (looksLikePlan(rawReply)) {
        setTimeout(() => {
          // Show card immediately with the reply text — extraction happens on accept
          setPendingSchedule({ raw: rawReply, parsed: null });
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 400);
      }

    } catch (err) {
      console.log('Coach error:', err?.message);
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong: ${err?.message || 'Unknown error'}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleAddToCalendar = async () => {
    if (!pendingSchedule) return;
    setPendingSchedule(null);

    // Show a loading message while extracting dates
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '⏳ Adding your workouts to the calendar…',
    }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const schedule = await extractScheduleFromText(pendingSchedule.raw, getTomorrowStr());
      if (!schedule || schedule.length === 0) throw new Error('Could not extract schedule');

      setScheduledWorkouts(schedule);
      const count = schedule.length;
      setMessages(prev => {
        // Replace the loading message with the success message
        const updated = [...prev];
        updated[updated.length - 1] = {
          role:    'assistant',
          content: `✅ Done! I've added ${count} workout${count !== 1 ? 's' : ''} to your calendar and Plan tab. Check the Today tab to see what's coming up! 💪`,
        };
        return updated;
      });
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role:    'assistant',
          content: `Sorry, I couldn't extract the schedule. Try asking me again to "create a weekly plan" and I'll set it up.`,
        };
        return updated;
      });
    }
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleDeclineCalendar = () => {
    setPendingSchedule(null);
    setMessages(prev => [...prev, {
      role:    'assistant',
      content: `No problem! Just ask me anytime if you want me to schedule a plan for you. 😊`,
    }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.coachBadge}>
              <Text style={styles.coachBadgeText}>✨</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>AI Coach</Text>
              <Text style={styles.headerSub}>Always here to help</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => { setMessages([]); setPendingSchedule(null); }}
              activeOpacity={0.7}
            >
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
            <HeaderActions />
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {visibleMessages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {loading && (
            <View style={styles.bubbleRow}>
              <View style={styles.coachAvatar}>
                <Text style={styles.coachAvatarText}>✨</Text>
              </View>
              <TypingDots />
            </View>
          )}

          {/* Calendar action card appears inline in the chat */}
          {pendingSchedule && !loading && (
            <CalendarCard
              onAccept={handleAddToCalendar}
              onDecline={handleDeclineCalendar}
            />
          )}

          {showQuickSuggestions && !loading && (
            <View style={styles.suggestions}>
              <Text style={styles.suggestionsLabel}>Quick questions</Text>
              {QUICK_SUGGESTIONS.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.suggestionChip}
                  onPress={() => sendMessage(s.text)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.suggestionIcon}>{s.icon}</Text>
                  <Text style={styles.suggestionText}>{s.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask your coach anything…"
            placeholderTextColor={colors.text3}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnOff]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.sendIcon}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (colors) => StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.bg },

  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerLeft:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  coachBadge:       { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent + '18', alignItems: 'center', justifyContent: 'center' },
  coachBadgeText:   { fontSize: 22 },
  headerTitle:      { fontSize: 17, fontWeight: '800', color: colors.text },
  headerSub:        { fontSize: 12, color: colors.text3 },
  headerRight:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  clearBtn:         { backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.border },
  clearBtnText:     { fontSize: 13, color: colors.text2, fontWeight: '600' },

  messages:         { flex: 1 },
  messagesContent:  { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },

  bubbleRow:        { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, gap: 8 },
  bubbleRowUser:    { flexDirection: 'row-reverse' },
  coachAvatar:      { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent + '18', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  coachAvatarText:  { fontSize: 16 },
  bubble:           { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, ...shadow.card },
  bubbleCoach:      { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleUser:       { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleText:       { fontSize: 14, color: colors.text, lineHeight: 20 },
  bubbleTextUser:   { color: '#fff' },

  // Calendar card
  calCard:          { flex: 1, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.accent + '55', padding: 14, borderBottomLeftRadius: 4, ...shadow.card },
  calCardTitle:     { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 4 },
  calCardSub:       { fontSize: 13, color: colors.text2, marginBottom: 12 },
  calPreview:       { backgroundColor: colors.bg, borderRadius: 12, padding: 10, marginBottom: 12, gap: 6 },
  calPreviewRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  calDot:           { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  calPreviewDate:   { fontSize: 12, color: colors.text3, width: 80 },
  calPreviewTitle:  { fontSize: 13, fontWeight: '600', color: colors.text, flex: 1 },
  calPreviewDur:    { fontSize: 12, color: colors.text3 },
  calMoreText:      { fontSize: 12, color: colors.text3, textAlign: 'center', paddingTop: 4 },
  calBtns:          { flexDirection: 'row', gap: 8 },
  calBtn:           { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  calBtnYes:        { color: '#fff', fontWeight: '700', fontSize: 13 },
  calBtnNo:         { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  calBtnNoText:     { fontWeight: '600', fontSize: 13 },

  suggestions:      { marginTop: 16 },
  suggestionsLabel: { fontSize: 12, fontWeight: '700', color: colors.text3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  suggestionChip:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  suggestionIcon:   { fontSize: 18 },
  suggestionText:   { fontSize: 14, color: colors.text, fontWeight: '500', flex: 1 },

  inputRow:         { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  input:            { flex: 1, backgroundColor: colors.bg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border, maxHeight: 100 },
  sendBtn:          { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff:       { backgroundColor: colors.border },
  sendIcon:         { fontSize: 18, color: '#fff', fontWeight: '700' },
});
