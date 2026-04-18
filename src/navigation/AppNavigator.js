import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Image, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useColors from '../lib/useColors';

import DashboardScreen  from '../screens/DashboardScreen';
import TrackScreen      from '../screens/TrackScreen';
import PlanScreen       from '../screens/PlanScreen';
import ProgressScreen   from '../screens/ProgressScreen';
import SocialScreen     from '../screens/SocialScreen';
import ProfileScreen    from '../screens/ProfileScreen';
import CoachScreen      from '../screens/CoachScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ── Tab icon images ──────────────────────────────────────────────────────────
// Step 1: Drop your 5 PNG files into assets/ with these exact names:
//   tab-today.png | tab-workouts.png | tab-plan.png | tab-community.png | tab-coach.png
// Step 2: Flip USING_CUSTOM_ICONS to true, then run: npx expo start --clear
const USING_CUSTOM_ICONS = true;

const TAB_ICONS = USING_CUSTOM_ICONS ? {
  Dashboard: require('../../assets/tab-today.png'),
  Workout:   require('../../assets/tab-workouts.png'),
  Plan:      require('../../assets/tab-plan.png'),
  Social:    require('../../assets/tab-community.png'),
  Coach:     require('../../assets/tab-coach.png'),
} : null;

const TABS = [
  { name: 'Dashboard', component: DashboardScreen, label: 'Today',     emoji: '🏠'  },
  { name: 'Workout',   component: TrackScreen,     label: 'Workout',   emoji: '🏋️' },
  { name: 'Plan',      component: PlanScreen,      label: 'Plan',      emoji: '📋'  },
  { name: 'Social',    component: SocialScreen,    label: 'Community', emoji: '👥'  },
  { name: 'Coach',     component: CoachScreen,     label: 'Coach',     emoji: '✨'  },
];

function MainTabs() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const tabBarHeight = 64 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor:  colors.border,
          borderTopWidth:  1,
          paddingBottom:   insets.bottom || 6,
          paddingTop:      6,
          height:          tabBarHeight,
        },
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.text3,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: 2 },
        tabBarIcon: ({ focused }) => {
          const tab = TABS.find(t => t.name === route.name);
          if (USING_CUSTOM_ICONS && TAB_ICONS?.[route.name]) {
            return (
              <Image
                source={TAB_ICONS[route.name]}
                style={{ width: focused ? 30 : 26, height: focused ? 30 : 26, opacity: focused ? 1 : 0.4 }}
                resizeMode="contain"
              />
            );
          }
          return <Text style={{ fontSize: focused ? 22 : 19 }}>{tab?.emoji}</Text>;
        },
      })}
    >
      {TABS.map(tab => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{ tabBarLabel: tab.label }}
        />
      ))}
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main"     component={MainTabs}      />
      <Stack.Screen name="Profile"  component={ProfileScreen} />
      <Stack.Screen name="Progress" component={ProgressScreen} />
    </Stack.Navigator>
  );
}
