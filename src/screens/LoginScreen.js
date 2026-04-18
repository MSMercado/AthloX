import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { signInWithProvider } from '../lib/socialAuth';
import useColors from '../lib/useColors';

const SOCIAL = [
  { id: 'google',   label: 'Continue with Google',   bg: '#fff',     textColor: '#333', borderColor: '#e8e8e8' },
  { id: 'apple',    label: 'Continue with Apple',    bg: '#000',     textColor: '#fff', borderColor: '#000'   },
  { id: 'facebook', label: 'Continue with Facebook', bg: '#1877f2',  textColor: '#fff', borderColor: '#1877f2'},
  { id: 'twitter',  label: 'Continue with X',        bg: '#000',     textColor: '#fff', borderColor: '#000'   },
];

function SocialIcon({ id, styles }) {
  if (id === 'google') {
    return (
      <View style={styles.googleIconWrap}>
        <Text style={styles.googleIconText}>G</Text>
      </View>
    );
  }
  if (id === 'apple')    return <Text style={styles.appleIcon}></Text>;
  if (id === 'facebook') return <Text style={styles.socialIcon}>f</Text>;
  if (id === 'twitter')  return <Text style={styles.socialIcon}>𝕏</Text>;
  return null;
}

export default function LoginScreen({ onBack, onSwitch }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);
  const [err, setErr]             = useState('');
  const [resetSent, setResetSent] = useState(false);

  const login = async () => {
    if (!email || !password) { setErr('Please fill in all fields.'); return; }
    setLoading(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setErr(error.message);
  };

  const forgotPassword = async () => {
    if (!email) { setErr('Enter your email address first.'); return; }
    await supabase.auth.resetPasswordForEmail(email.trim());
    setResetSent(true); setErr('');
  };

  const handleSocial = async (provider) => {
    setSocialLoading(provider);
    setErr('');
    try {
      await signInWithProvider(provider);
    } catch (e) {
      if (e.message === 'EXPO_GO') {
        setErr('Social login requires a full app build. Use email & password to test for now.');
      } else {
        setErr(e.message || `${provider} sign-in failed`);
      }
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Welcome{'\n'}Back</Text>
          <Text style={styles.subtitle}>Sign in to continue your journey</Text>

          {SOCIAL.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.socialBtn, { backgroundColor: s.bg, borderColor: s.borderColor }]}
              onPress={() => handleSocial(s.id)}
              disabled={!!socialLoading}
              activeOpacity={0.85}
            >
              {socialLoading === s.id
                ? <ActivityIndicator color={s.textColor} style={{ marginRight: 12 }} />
                : <SocialIcon id={s.id} styles={styles} />
              }
              <Text style={[styles.socialBtnText, { color: s.textColor }]}>{s.label}</Text>
            </TouchableOpacity>
          ))}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or with email</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor={colors.text3}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={colors.text3}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {!!err      && <Text style={styles.errText}>{err}</Text>}
          {resetSent  && <Text style={styles.successText}>✓ Password reset email sent! Check your inbox.</Text>}

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={login}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Sign In</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={forgotPassword} style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onSwitch} style={styles.switchBtn}>
            <Text style={styles.switchText}>
              No account?{'  '}
              <Text style={styles.switchAccent}>Sign up free</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.bg },
  scroll:         { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },

  backBtn:        { marginBottom: 20 },
  backText:       { fontSize: 15, color: colors.text2, fontWeight: '600' },

  title:          { fontSize: 42, fontWeight: '900', color: colors.text, lineHeight: 46, marginBottom: 8 },
  subtitle:       { fontSize: 15, color: colors.text2, marginBottom: 24 },

  socialBtn:      { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10, borderWidth: 2 },
  socialBtnText:  { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700' },

  googleIconWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f1f3f4', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  googleIconText: { fontSize: 14, fontWeight: '700', color: '#4285F4' },
  appleIcon:      { fontSize: 18, color: '#fff', marginRight: 12, lineHeight: 22 },
  socialIcon:     { fontSize: 16, color: '#fff', marginRight: 12, fontWeight: '700', width: 24, textAlign: 'center' },

  divider:        { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 12 },
  dividerLine:    { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText:    { fontSize: 13, color: colors.text3 },

  label:          { fontSize: 13, fontWeight: '600', color: colors.text2, marginBottom: 8 },
  input:          { backgroundColor: colors.surface, borderRadius: 14, padding: 16, fontSize: 16, color: colors.text, marginBottom: 16, borderWidth: 1, borderColor: colors.border },

  errText:        { color: colors.red, fontSize: 13, marginBottom: 10 },
  successText:    { color: colors.green, fontSize: 13, marginBottom: 10 },

  btn:            { backgroundColor: colors.text, borderRadius: 16, paddingVertical: 17, alignItems: 'center', marginTop: 4, marginBottom: 4 },
  btnText:        { color: colors.bg, fontSize: 16, fontWeight: '700' },

  forgotBtn:      { alignItems: 'center', paddingVertical: 14 },
  forgotText:     { fontSize: 13, color: colors.accent, fontWeight: '600' },

  switchBtn:      { alignItems: 'center', marginTop: 8 },
  switchText:     { fontSize: 15, color: colors.text2 },
  switchAccent:   { color: colors.accent, fontWeight: '700' },
});
