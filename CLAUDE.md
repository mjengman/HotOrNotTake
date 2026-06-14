# Hot or Not Takes - Living Project Notes

This file is the current operating guide for agents and maintainers. Historical launch/build notes live in `docs/archive/`; use this file and the codebase as the source of truth.

## Production Status

Hot or Not Takes is live in production on both mobile stores.

- Google Play package: `com.anonymous.HotOrNotTakes`
- Apple bundle identifier: `com.hotornottakes.app`
- Current app version in Expo config: `1.0.5`
- Firebase project: `hot-or-not-takes`
- EAS project ID: `7d390f1c-4d9b-4414-a359-2d8fd3f3ed43`

Do not rename the Android package. Google Play continuity depends on `com.anonymous.HotOrNotTakes`, even though the iOS bundle uses the cleaner `com.hotornottakes.app`.

## Stack

- React Native with Expo SDK 53
- TypeScript with `strict` enabled
- Firebase Auth, Firestore, and Analytics
- AdMob via `react-native-google-mobile-ads`
- Google UMP consent flow for ads/GDPR
- EAS Build and EAS Updates

The repo has checked-in `ios/` and `android/` folders. Because this is not a pure CNG project, native config in `app.config.js` does not automatically update existing native projects. When changing native app identity, ads IDs, permissions, splash/icon, updates, or build settings, verify the matching native files too.

## App Shape

The app is effectively single-root:

- `index.ts` registers `App.tsx`
- `App.tsx` initializes ad consent and renders `HomeScreen`
- `HomeScreen` owns the main app state and renders full-screen overlays for submit, my takes, leaderboard, recent votes, and favorites
- `CustomSwipeableCardDeck` is the active card deck implementation
- `useFirebaseTakes` owns the paginated feed, vote submission, skip submission, and re-vote flow

Legacy `SwipeableCardDeck`, `useTakes`, sample data, and class-based ad service code were removed during the Sprint 1 cleanup. Prefer the hook-based ad and Firebase paths.

## Data Model

Main Firestore collections:

- `takes`: user-submitted approved content plus vote totals
- `votes`: per-user vote records
- `skips`: analytics records for skipped takes
- `users`: anonymous user profile/stats documents
- `users/{userId}/favorites`: saved takes

The feed filters out voted takes. Skipped takes can reappear by design.

## AI and Moderation

The app still contains legacy client-side OpenAI moderation/generation code. Treat it as technical debt:

- Do not add new client-side OpenAI calls.
- Do not expose or log API key details in new code.
- Future moderation/generation should move behind a backend, such as Firebase Cloud Functions.

## Build and Release Guardrails

Before merging release-affecting changes:

1. Run `npx tsc --noEmit`.
2. Run `npx expo-doctor` and review warnings.
3. Verify `app.config.js`, `ios/`, and `android/` agree where native config matters.
4. Confirm the Android package remains `com.anonymous.HotOrNotTakes`.
5. Confirm the iOS bundle identifier remains `com.hotornottakes.app`.
6. Human smoke-test both iOS and Android simulators before any OTA update or store submission.

Smoke-test checklist owner: human/PM. Codex can prepare the build and call out expected checks, but a human should verify both emulators look normal after cleanup or release PRs merge.

### Current Expo Doctor Notes

As of Sprint 1 cleanup, `npx expo-doctor` still reports known maintenance warnings:

- Expo SDK 53 patch alignment: expected `expo@~53.0.27` and `react-native@0.79.6`.
- `@expo/metro-config` is one patch behind the expected support package version.
- Local CocoaPods version/tooling could not be verified in this environment.
- Native folders are checked in, so app config fields are not automatically synced.

Do not hide these warnings. Resolve dependency/tooling drift in a dedicated maintenance sprint rather than mixing it into feature work.

## Product Backlog

Use `FUTURE_FEATURES.md` as the product idea backlog. Sprint 2 candidate: daily voting streaks.

## Git Hygiene

- Use branches prefixed with `codex/` for Codex implementation work.
- Keep cleanup PRs separate from feature PRs.
- Do not commit local build artifacts, ignored native build folders, `.env` files, or editor temp files.
- `docs/archive/` is for historical records, not current instructions.
