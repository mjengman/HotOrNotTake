# 🔥 Hot or Not Takes

A React Native app for swiping judgment on controversial, funny, or outrageous hot takes — from food opinions to life philosophy. Players swipe **HOT** if they agree with the take, or **NOT** if they think it’s nonsense. Users can also submit their own takes to be judged by the world.

---

## 🧠 Core Concept

**Hot or Not Takes** is a simple, addictive, swipe-based mobile game where users:
- View short, punchy hot takes
- Swipe right for 🔥 HOT (bold/true)
- Swipe left for 🗑️ NOT (bad/wrong)
- See how the community voted after swiping
- Submit their own takes to enter the judgment arena

---

## 🗺️ Development Roadmap

We’ll build the app in **4 key phases** to ensure smooth development, rapid feedback, and eventual production-readiness.

---

## 🚀 Phase 1: MVP Gameplay (Local w/ Expo Go)

### ✅ Goals:
- Build core swipe interaction
- Display static list of hot takes
- Animate vote response and store vote locally
- Tally votes in local state
- Basic UI polish (light/dark theme, basic iconography)

### 📦 Key Features:
- Swipeable card deck (using `react-native-deck-swiper` or similar)
- Hot take text
- HOT / NOT visual indicator + count
- Simple state for vote counts
- End of deck behavior (restart, loop, or message)

---

## 🔌 Phase 2: Firebase Integration

### ✅ Goals:
- Store hot takes in Firestore
- Save vote data (user/take/choice)
- Submit new hot takes
- Moderate or auto-approve new takes

### 📦 Key Features:
- Firebase Auth (anonymous login)
- Firebase Firestore setup
- Cloud Functions for moderation (optional)
- Vote history stored per user (optional)
- Load dynamic takes in real-time

---

## 💰 Phase 3: Monetization + Social

### ✅ Goals:
- Add ads to monetize usage
- Enable social sharing and engagement

### 📦 Key Features:
- Banner Ads (Google AdMob)
- Interstitial ads after every 10 swipes
- Share a take with your vote to social (deep links or image)
- Bookmark/save favorite takes
- Optional "Pro" version logic (e.g. ad removal)

---

## 📱 Phase 4: Polish & Launch

### ✅ Goals:
- Final UI/UX polish
- Prepare for production builds
- App Store / Play Store compliance

### 📦 Key Features:
- Onboarding flow
- Profile page (my takes, my stats)
- Leaderboards (optional)
- Push notifications (e.g. “Your take is trending!”)
- App icons, splash screen, build signing
