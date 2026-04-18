import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { supabase } from './src/lib/supabase';
import useStore from './src/store/useStore';
import { colors, lightColors, darkColors } from './src/lib/theme';
import {
  requestNotificationPermission,
  applyNotificationSettings,
  setupNotificationTapHandler,
} from './src/lib/notifications';

import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen  from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import XPPopup     from './src/components/XPPopup';

export default function App() {
  const { setUser, setSession, hydrate, darkMode, notifSettings } = useStore();
  const [authState, setAuthState] = useState('loading');
  const navigationRef = useRef(null);

  useEffect(() => {
    hydrate();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setAuthState(session ? 'app' : 'splash');

      // Once logged in, request permission and apply saved notification settings
      if (session) {
        requestNotificationPermission().then(granted => {
          if (granted) {
            applyNotificationSettings(
              notifSettings || { workout: true, streak: true, coach: false }
            );
          }
        });
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) setAuthState('app');
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Wire up notification tap → navigate to the right screen
  useEffect(() => {
    const cleanup = setupNotificationTapHandler(navigationRef);
    return cleanup;
  }, []);

  const themeColors = darkMode ? darkColors : lightColors;
  const barStyle    = darkMode ? 'light-content' : 'dark-content';
  const barBg       = themeColors.surface;

  const splashBar = (
    <StatusBar barStyle="light-content" backgroundColor="#0d0d0d" translucent={false} />
  );
  const themedBar = (
    <StatusBar barStyle={barStyle} backgroundColor={barBg} translucent={false} />
  );

  if (authState === 'loading') {
    return (
      <View style={styles.loading}>
        {splashBar}
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (authState === 'splash') {
    return (
      <SafeAreaProvider>
        {splashBar}
        <SplashScreen
          onGetStarted={() => setAuthState('signup')}
          onLogin={() => setAuthState('login')}
        />
      </SafeAreaProvider>
    );
  }

  if (authState === 'login') {
    return (
      <SafeAreaProvider>
        {themedBar}
        <LoginScreen
          onBack={() => setAuthState('splash')}
          onSwitch={() => setAuthState('signup')}
        />
      </SafeAreaProvider>
    );
  }

  if (authState === 'signup') {
    return (
      <SafeAreaProvider>
        {themedBar}
        <SignupScreen
          onBack={() => setAuthState('splash')}
          onSwitch={() => setAuthState('login')}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      {themedBar}
      <NavigationContainer ref={navigationRef}>
        <AppNavigator />
      </NavigationContainer>
      <XPPopup />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
