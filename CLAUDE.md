# Hot or Not Takes - Living Project Notes

This file is the current operating guide for agents and maintainers. Historical launch/build notes live in `docs/archive/`; use this file and the codebase as the source of truth.

## Production Status

Hot or Not Takes is live in production on both mobile stores.

- Google Play package: `com.anonymous.HotOrNotTakes`
- Apple bundle identifier: `com.hotornottakes.app`
- Current app version in Expo config: `1.0.8`
- Firebase project: `hot-or-not-takes`
- EAS project ID: `7d390f1c-4d9b-4414-a359-2d8fd3f3ed43`

Do not rename the Android package. Google Play continuity depends on `com.anonymous.HotOrNotTakes`, even though the iOS bundle uses the cleaner `com.hotornottakes.app`.

## Stack

- React Native with Expo SDK 53
- TypeScript with `strict` enabled
- Firebase Auth, Firestore, and Analytics
- AdMob via `react-native-google-mobile-ads`
- Google UMP consent flow for ads/GDPR
- Local notifications via `expo-notifications`
- EAS Build and EAS Updates

The repo has checked-in `ios/` and `android/` folders. Because this is not a pure CNG project, native config in `app.config.js` does not automatically update existing native projects. When changing native app identity, ads IDs, permissions, splash/icon, updates, or build settings, verify the matching native files too.

Local notifications are intentionally local-only. The app uses `expo-notifications`, Android notification icon/color metadata is synced in `android/`, and iOS should not add an `aps-environment` entitlement unless the product explicitly moves to push notifications/APNs.

As of the 1.0.8 local-notifications release prep, `app.config.js`, Android native `versionName`, and iOS native `CFBundleShortVersionString` have been synced to `1.0.8`. EAS remote app-version source currently owns the monotonically increasing Android `versionCode` and iOS build number; confirm `eas build:version:get --platform all --non-interactive` before production builds.

## App Shape

The app is effectively single-root:

- `index.ts` registers `App.tsx`
- `App.tsx` initializes ad consent and renders `HomeScreen`
- `HomeScreen` owns the main app state and renders full-screen overlays for submit, my takes, leaderboard, vote history, and favorites
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

User submissions are moderated by the `submitTake` Firebase HTTPS function before any take can become visible in the public feed.

- The OpenAI key must live only in Firebase Secret Manager as `OPENAI_API_KEY`.
- Do not add client-side OpenAI calls, `EXPO_PUBLIC_OPENAI_API_KEY`, EAS OpenAI env vars, or Expo config extras for OpenAI keys.
- The client sends the user's Firebase ID token in `X-Firebase-Auth`; do not use the `Authorization` header for this endpoint because Cloud Run consumes it before the function handler can verify Firebase Auth.
- Firestore rules block clients from creating approved takes directly; trusted server code writes approved takes with Admin privileges.
- Clean submissions are auto-approved by AI and appear in the feed quickly.
- Rejected submissions return a user-facing reason and are not written as approved content.
- If OpenAI moderation fails, the function creates the take as `status: pending` / `isApproved: false`; pending takes are invisible to everyone except the submitter until manually reviewed in Firebase Console.
- Firebase Cloud Functions secrets require the Firebase project to be on the Blaze plan.

AI content generation is server-side only:

- `useFirebaseTakes` asks the `generateTakes` HTTPS function for more content when the visible feed drops to 3 takes or fewer.
- The client sends only the selected category and Firebase ID token; it never sends, stores, or derives an OpenAI key.
- If the selected category is `all`, the function chooses the valid category with the fewest approved takes in Firestore so the library stays balanced over time.
- Generated takes are moderated through the same local policy and OpenAI moderation path before they are written.
- Approved generated takes are written with `status: approved`, `isApproved: true`, `isAIGenerated: true`, and `userId: ai-system`.
- Generation failures are swallowed by the client; the user should never see an error or spinner because background generation failed.

## Build and Release Guardrails

Before merging release-affecting changes:

1. Run `npx tsc --noEmit`.
2. If `functions/` changed, run `npm --prefix functions run typecheck`.
3. Run `npx expo-doctor` and review warnings.
4. Verify `app.config.js`, `ios/`, and `android/` agree where native config matters.
5. Confirm the Android package remains `com.anonymous.HotOrNotTakes`.
6. Confirm the iOS bundle identifier remains `com.hotornottakes.app`.
7. Human smoke-test both iOS and Android simulators before any OTA update or store submission.

iOS production EAS builds pin `build.production.ios.image` to `macos-sequoia-15.6-xcode-26.0` so App Store submissions are built with the iOS 26 SDK while the app remains on Expo SDK 53.

Smoke-test checklist owner: human/PM. Codex can prepare the build and call out expected checks, but a human should verify both emulators look normal after cleanup or release PRs merge.

### Current Expo Doctor Notes

As of Sprint 1 cleanup, `npx expo-doctor` still reports known maintenance warnings:

- Expo SDK 53 patch alignment: expected `expo@~53.0.27` and `react-native@0.79.6`.
- `@expo/metro-config` is one patch behind the expected support package version.
- Local CocoaPods version/tooling could not be verified in this environment.
- Native folders are checked in, so app config fields are not automatically synced.

Do not hide these warnings. Resolve dependency/tooling drift in a dedicated maintenance sprint rather than mixing it into feature work.

## Product Backlog

Use `FUTURE_FEATURES.md` as the product idea backlog. Keep completed sprint notes here only when they change current operating behavior.

## Git Hygiene

- Use branches prefixed with `codex/` for Codex implementation work.
- Keep cleanup PRs separate from feature PRs.
- Do not commit local build artifacts, ignored native build folders, `.env` files, or editor temp files.
- `docs/archive/` is for historical records, not current instructions.
