# AthloX — Train Like an Athlete

> A full-stack React Native fitness app built for serious athletes. Strength training, GPS cardio tracking, AI coaching, and gamified progression — all in one place.

---

## Overview

AthloX is a complete training companion built from the ground up with React Native and Expo. It combines personalised workout planning, GPS activity tracking, an AI coach powered by Groq/LLaMA, and a gamification system (XP + levels) to keep athletes engaged and progressing.

The app is currently in active development and targeting release on the Google Play Store.

---

## Features

### Onboarding
- 8-step personalised onboarding flow (athlete type → goal → timeline → level → equipment → plan preview → account → metrics)
- Live workout plan generated from user answers — real exercises, correct for their equipment and fitness level
- Plan is saved and immediately available in the Plan tab after signup

### Workout Tab
- **Exercise Library** — 12 muscle group categories (Chest, Back, Legs, Shoulders, Biceps, Triceps, Core, Glutes, Hamstrings, Full Body, Calves, Forearms) with difficulty badges and tutorial popups
- **Workout Builder** — browse categories, add multiple exercises, then start your custom session
- **GPS Activity Tracking** — Run, Bike, Walk, Hike with live distance, pace (rolling 30-second window), avg pace, and calorie tracking
- GPS setup flow: signal acquisition screen → 3-2-1 animated countdown → active tracking
- Strength workout tracker with set-by-set logging, rest timers, and progress bar

### Plan Tab
- AI-generated multi-week training plans (4–52 weeks) via Groq LLaMA API
- Week-by-week schedule with exercise breakdowns, sets, reps, and rest
- Exercise tutorial modal for every movement
- Coach-scheduled workouts integrated into the calendar
- Progress bar tracking across the full plan duration

### AI Coach Tab
- Real-time chat with an AI personal trainer (Groq LLaMA 3)
- Context-aware responses based on user profile (fitness level, goal, equipment)
- Ability to schedule workouts directly from the chat into the Plan tab

### Today (Dashboard)
- Dynamic greeting with personalised name
- Today's scheduled workout with one-tap start
- Weekly stats (calories, minutes, sessions)
- Current streak counter
- XP level badge
- Weekly activity chart
- Recent workout log

### Gamification
- 8 XP levels: Noob → Rookie → Grinder → Athlete → Warrior → Champion → Elite → Legend
- XP awarded on every workout completion and GPS activity
- Confetti popup animation on XP gain with animated progress bar and level-up badge
- XP progress displayed on Profile tab

### Profile & Settings
- Display name, weight, height, and units (metric/imperial)
- Dark mode toggle
- Notification settings (workout reminders, streak alerts, coach messages)
- XP progress card with level display

### Community Tab
- Share completed workouts to the in-app feed
- Social sharing to X (Twitter), Facebook, and Instagram
- Community activity feed

---

## Tech Stack

| Area | Technology |
|------|-----------|
| Framework | React Native + Expo SDK 53 |
| Navigation | React Navigation (Bottom Tabs + Native Stack) |
| State Management | Zustand + AsyncStorage persistence |
| Backend / Auth | Supabase (PostgreSQL + Auth) |
| AI / LLM | Groq API — LLaMA 3.1 8B Instant |
| Location | expo-location (GPS tracking) |
| Notifications | expo-notifications |
| Build | Expo EAS Build (cloud builds) |
| Auth Providers | Email + Google OAuth + Apple (via Supabase) |

---

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── XPPopup.js       # Animated XP/level-up celebration overlay
│   └── HeaderActions.js
├── data/
│   ├── exercises.js     # Full exercise library (200+ exercises)
│   └── exerciseTutorials.js
├── lib/
│   ├── supabase.js      # Supabase client
│   ├── xp.js            # XP constants, level calculator
│   ├── useColors.js     # Theme-aware color hook
│   ├── notifications.js
│   └── community.js
├── navigation/
│   └── AppNavigator.js  # Tab + stack navigator setup
├── screens/
│   ├── DashboardScreen.js   # Today tab
│   ├── TrackScreen.js       # Workout tab
│   ├── PlanScreen.js        # Training plan tab
│   ├── CoachScreen.js       # AI coach chat
│   ├── SocialScreen.js      # Community feed
│   ├── ProfileScreen.js     # User profile
│   ├── SignupScreen.js      # Onboarding flow
│   ├── LoginScreen.js
│   └── SplashScreen.js
└── store/
    └── useStore.js          # Zustand global store
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo`)
- EAS CLI (`npm install -g eas-cli`)
- A Supabase project
- A Groq API key

### Installation

```bash
git clone https://github.com/YOUR-USERNAME/athlox.git
cd athlox
npm install
```

### Environment Variables

Create a `.env` file in the root:

```env
EXPO_PUBLIC_GROQ_KEY=your_groq_api_key_here
```

Add your Supabase URL and anon key to `src/lib/supabase.js`.

### Run in development

```bash
npx expo start
```

### Build for production (Android)

```bash
eas build --platform android --profile production
```

---

## Design Decisions

- **No emoji in UI** — The app uses colored accent bars, dots, and typography to convey personality rather than emoji, giving it a premium, serious feel similar to Nike Training Club and Whoop.
- **Offline-first** — All user data (XP, logs, routines, plan) is persisted locally via AsyncStorage and synced with Supabase when online.
- **Equipment-aware** — Every exercise in the onboarding plan and workout library adapts to the user's available equipment (none/bands/dumbbells/full gym) and fitness level.
- **GPS accuracy** — Pace uses a rolling 30-second window (not instant speed) to smooth out GPS noise and give more accurate readings.

---

## Roadmap

- [ ] iOS App Store release
- [ ] Subscription tiers via RevenueCat (free / premium / elite)
- [ ] Wearable heart rate integration (Apple Watch / Wear OS)
- [ ] Progress photos
- [ ] Social following and leaderboards
- [ ] Offline workout plan caching

---

## Author

Built by Julie — solo founder, product designer, and developer.

> "Train Like an Athlete. Not Like Everyone Else."

---

## License

This project is private and not open for redistribution. Source code is shared publicly for portfolio purposes only.
