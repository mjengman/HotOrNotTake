# Satellite Cluster Audit

This audit reviews graphify clusters that were disconnected from the main app
component or unusually self-contained. The goal is to distinguish useful
standalone systems from dormant code that will confuse future work.

## Summary

| Area | Current classification | Recommendation |
| --- | --- | --- |
| `src/scripts/markStarterDeck.ts` | Active operational tool | Keep and document as starter-deck tooling |
| `src/scripts/clearDatabase.ts` | Dangerous legacy reset tool | Remove or quarantine before future release work |
| `src/scripts/seedDatabase.ts` | Dead commented-out legacy code | Delete when convenient |
| `src/services/personalityEngine.ts` | Dormant product/AI-content idea | Decide whether to integrate or archive |
| `src/services/enhancedPrompts.ts` | Dormant AI-content prompt library | Decide whether to integrate or archive |
| `src/components/transitions/TransitionWrapper.tsx` | Unused UI abstraction | Delete unless a near-term screen needs it |
| `src/utils/environment.ts` | Unused Expo Go helper | Delete unless Expo Go-specific work returns |
| `src/types/firebase-auth-react-native.d.ts` | Active type compatibility shim | Keep |
| `src/services/adsConsent.ts` alias | Backward-compatible alias only | Keep for now; remove alias later if unused |
| Title banner assets | Active app assets | Keep |

## Evidence

The graph exposed these areas because they appeared as small, disconnected
components. A follow-up repo search found:

- `markStarterDeck.ts` is wired through `npm run mark:starter`.
- `clearDatabase.ts` is tracked but has no package script and executes a delete
  flow when run directly.
- `seedDatabase.ts` is entirely commented out.
- `personalityEngine.ts` exports prompt/personality helpers but has no app import.
- `enhancedPrompts.ts` exports prompt helpers but has no app import.
- `TransitionWrapper.tsx` exports reusable animated wrappers but has no app import.
- `environment.ts` exports Expo Go helpers but has no app import.
- `firebase-auth-react-native.d.ts` augments `firebase/auth` typing and does not
  need runtime imports.
- `adsConsent.ts` itself is active through `App.tsx`; only the
  `openPrivacyOptionsForm` alias appears unused.

## Active Or Keep

### `src/scripts/markStarterDeck.ts`

This is active operational tooling. It marks hand-curated takes with
`editorialTier: 'starter'`, `featured: true`, `starterDeckRank`, and `curatedAt`.
It has a dry-run mode and an apply mode, and is exposed as `npm run mark:starter`.

Keep it. If starter-deck work becomes frequent, add it to the content-ops section
of `CLAUDE.md`.

### `src/types/firebase-auth-react-native.d.ts`

This is a compile-time compatibility shim for `getReactNativePersistence`.
Its isolated graph position is expected because declaration files are not called
at runtime.

Keep it unless Firebase typings make it unnecessary and `npx tsc --noEmit`
confirms removal is safe.

### Title banner assets

The title banner images are intentionally isolated static assets. No action.

## Archive Or Remove Candidates

### `src/scripts/seedDatabase.ts`

This file is commented-out seed data and a commented-out seed function. It is not
an active script.

Recommendation: delete it in a cleanup PR. If seed data is needed again, recreate
it as an explicit npm script with dry-run/apply behavior like `markStarterDeck`.

### `src/scripts/clearDatabase.ts`

This script signs in anonymously and deletes whole Firestore collections. It is
not wired through `package.json`, but because it is tracked and executable by
direct `tsx`, it is a sharp edge.

Recommendation: remove it, move it to archived notes, or require a much stronger
explicit production-safety gate before keeping it. Do not leave it as casual
tracked tooling without docs.

### `src/components/transitions/TransitionWrapper.tsx`

This is a reusable animation wrapper, but no current app file imports it. The app
already uses concrete animation components in active screens.

Recommendation: delete unless a near-term UI task explicitly needs this wrapper.
Unused UI abstractions tend to drift from the actual design system.

### `src/utils/environment.ts`

This Expo Go helper is currently unused. It may have been useful during earlier
device/emulator debugging, but the production app now has dev-client/native
build guardrails elsewhere.

Recommendation: delete unless upcoming Expo Go work needs it.

## Product Decision Candidates

### `src/services/personalityEngine.ts`

This is a real product idea, not random dead code: it defines personality
archetypes, category references, and helper functions for personality-shaped AI
prompts. However, the current app does not import it.

Recommendation: do not delete casually. Decide one of:

1. Integrate it into the content-generation path.
2. Reframe it as a future user-identity/archetype system.
3. Move it to archived product experiments if it is no longer part of the plan.

If it stays, add a short note explaining whether it is for generated content,
user voting identity, or both. Right now that boundary is ambiguous.

### `src/services/enhancedPrompts.ts`

This is also a substantive AI-content experiment: category prompt collections
and D20-style prompt selection. It is not imported by the current runtime or
server generation path.

Recommendation: evaluate together with `personalityEngine.ts`. These two files
look like related dormant content-generation strategy. Either wire them into the
server-side generation system intentionally, or archive them so they do not imply
active behavior.

## Follow-Up Actions

1. Delete or archive `seedDatabase.ts`, `TransitionWrapper.tsx`, and
   `environment.ts` after a TypeScript check.
2. Decide whether `clearDatabase.ts` should exist at all. If it remains, add an
   explicit npm script only after adding production-safety checks.
3. Make a product call on `personalityEngine.ts` and `enhancedPrompts.ts` before
   the next identity or AI-content sprint.
4. Consider a short `docs/CONTENT_TOOLING.md` if content-ops scripts keep
   accumulating.
