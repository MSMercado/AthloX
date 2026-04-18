import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';

const { width } = Dimensions.get('window');

export default function SplashScreen({ onGetStarted, onLogin }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const anim = { opacity: fadeAnim, transform: [{ translateY: slideAnim }] };

  return (
    <View style={styles.container}>
      {/* Decorative circles */}
      <View style={styles.circleTopRight} />
      <View style={styles.circleBottomLeft} />

      <SafeAreaView style={styles.inner}>
        {/* Logo image */}
        <Animated.View style={[styles.logoWrap, anim]}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, anim]}>
          Train Like an Athlete.{'\n'}Not Like Everyone Else.
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text style={[styles.subtitle, anim]}>
          Strength · Cardio · Recovery{'\n'}One complete training system
        </Animated.Text>

        {/* Buttons */}
        <Animated.View style={[styles.buttons, anim]}>
          <TouchableOpacity style={styles.btnPrimary} onPress={onGetStarted} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryText}>Get Started</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={onLogin} activeOpacity={0.85}>
            <Text style={styles.btnSecondaryText}>I have an account</Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.legal}>By continuing you agree to our Terms & Privacy Policy</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: colors.primary },
  inner:           { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

  circleTopRight:  { position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,77,0,0.12)' },
  circleBottomLeft:{ position: 'absolute', bottom: -60, left: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,77,0,0.08)' },

  logoWrap:        { marginBottom: 20, alignItems: 'center' },
  logoImage:       { width: 280, height: 200 },

  tagline:         { fontSize: 14, color: colors.accent, fontWeight: '700', textAlign: 'center', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  subtitle:        { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 26, marginBottom: 52 },

  buttons:         { width: '100%', maxWidth: 320, gap: 12 },
  btnPrimary:      { backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 17, alignItems: 'center', shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  btnPrimaryText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary:    { borderRadius: 16, paddingVertical: 15, alignItems: 'center', borderWidth: 2, borderColor: '#333' },
  btnSecondaryText:{ color: '#aaa', fontSize: 16, fontWeight: '600' },

  legal:           { marginTop: 32, fontSize: 11, color: '#444', textAlign: 'center' },
});
