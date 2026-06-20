# Future Features Backlog - Hot or Not Takes

**Updated**: June 20, 2026
**Status**: Living product roadmap
**Purpose**: Capture product ideas, deploy constraints, current priorities, and sprint candidates. This is not a promise list; it is where good ideas stay warm until they are scoped.

Hot or Not Takes is a production app with a real gameplay loop: swipe, reveal, react, repeat. The app now has enough foundation that future work should mostly make the core feed feel faster, fresher, smarter, and more personally rewarding before adding heavy new surfaces.

## Product Principles

- **Protect the core loop first**: Swipe, reveal, react, repeat must feel instant, reliable, and delightful.
- **Make every vote feel alive**: Results should feel like a social reveal, not a stat panel.
- **Build identity before comparison**: Personal stats and taste profiles matter more than global status mechanics.
- **Respect user memory**: Voted and skipped takes should feel gone from the main feed forever.
- **Make AI invisible in the right way**: AI content should feel human, varied, category-fit, and debate-worthy.
- **Prefer OTA improvements**: Ship JavaScript-only quality, retention, and copy improvements quickly when possible.
- **Keep native changes intentional**: Any new permission, dependency, or store build should earn its review cycle.
- **Stay anonymous-friendly**: Do not force real names or full accounts unless the value is obvious.
- **Protect store trust**: Safety, moderation, child-safety standards, and store metadata are product features.

## Current Product Baseline

These are no longer future ideas; they are part of the working product foundation in the current codebase or release line.

- Server-side moderation through Firebase Cloud Functions; OpenAI key stays off the client.
- Fail-closed moderation behavior: AI failures do not auto-approve bad content.
- Cloud Function AI generation refills under-supplied categories.
- Generated-take duplicate guard exists at write time for AI content.
- Feed quality tooling exists for generated-take audits, duplicate cleanup, and soft-removing duplicate AI content.
- Client feed warm-start cache renders returning users into cards quickly.
- Core loop vote outbox decouples card animation from Firestore writes.
- Feed filtering tracks voted and skipped takes; My Skips lets users revisit skipped takes intentionally.
- Vote History is the primary history surface, replacing the old last-10 Recent Votes model.
- Results card has dynamic reaction copy, percentage count-up, Save, Share result, Change vote, and Results Autoplay preference.
- Results share uses an image card plus app download/review-friendly link copy.
- Daily quest system supports several lightweight quest types.
- Quest completion has a warmer payoff toast instead of a flat status message.
- Achievement-lite toasts exist for vote count, streak, and all-category milestones.
- Footer stats expose streak, daily quest, and community votes with tap-to-explain nudges.
- Footer quest copy and glow encourage completion without telling users to leave after finishing.
- My Voting Style exists as the personal stats/taste profile surface.
- Leaderboards include Hottest, Nottest, Divisive, and Skipped, with local cache/prefetch.
- My Favorites, My Voting Style, Leaderboards, and feed surfaces use local caching where useful.
- First-session onboarding card teaches HOT, NOT, skip, and results reveal.
- Dark mode preference persists.
- Button dock has consistent ring styling, tap-fill acknowledgement, and empty-rewind shake.
- Submit a take and My Takes flows have been cleaned up and toned down.
- In-app safety/reporting standards exist through the menu flow.
- Store child-safety standards are published externally and reflected in app content.
- Local notifications are implemented for daily quest/streak-style engagement.
- Native review prompt is implemented for a positive quest-completion moment.
- Menu has an Invite & Review modal with invite share and store review redirect.

## North Star Metric

**Weekly Active Voters (WAV)** is the primary product metric.

The app wins when people come back and vote again. Total downloads, total takes, and total votes are useful, but Weekly Active Voters best captures whether Hot or Not Takes is becoming a repeat habit.

Supporting metrics:

- Votes per active user.
- Votes per session.
- D1 and D7 retention.
- Daily quest completion rate.
- Streak continuation rate.
- Result-share taps and completed shares.
- Vote History opens.
- My Skips opens and skipped-take conversions.
- My Voting Style opens.
- Report volume and moderation pending volume.
- Store page conversion after screenshot refresh.

## Current Risks

- **Core loop snags**: The loop is dramatically better, but occasional card sticking or delayed vote response is still the highest-risk UX issue.
- **Feed trust**: If voted/skipped takes or near-duplicates reappear, users feel like the app forgot them.
- **Warm cache edge cases**: Cached cards can render before Firestore reconciliation; cache paths must exclude interacted IDs aggressively.
- **AI repetition**: Generated content still risks repeated frames, repeated phrasing, semicolon overuse, and category drift.
- **Shuffle smell**: Current ordering can feel more random than thoughtfully fresh; repeated testing makes the weakness visible.
- **Perceived community size**: Small vote counts need copy that frames the moment instead of making the app feel empty.
- **Native module drift**: OTA bundles must degrade gracefully when a native module is missing from an older binary.
- **Store release friction**: Android/iOS builds, OTA compatibility, and service-account automation should stay healthy.

## Recommended Next Sprint Candidates

### 1. AI Content Generation Deep Dive + Feed Freshness

**Deploy path**: OTA for client feed ordering/filtering; Cloud Function deploy if generation prompts, quality scoring, or write-time guards change.

**Why**: The app is content-hungry in a good way. Better generated takes improve every session immediately, and better feed freshness protects the feeling that votes and skips matter.

Scope ideas:

- Inspect the current generation pipeline before changing prompts so we know where variety, shuffle, and duplicate checks actually live.
- Audit generated takes by category for repetition, blandness, category drift, and punctuation tics.
- Tune prompts to reduce semicolons and repeated AI frames.
- Add stronger per-category voice guidance.
- Add a quality rubric for generated takes before writing them.
- Strengthen duplicate and near-duplicate rejection for AI-generated content.
- Add banned frame/phrase guidance such as:
  - "is overrated and way too"
  - "people need to stop pretending"
  - "should be normalized"
  - "is not talked about enough"
- Improve feed ordering so "All Categories" feels varied without feeling random or repetitive.
- Review session-level text/topic de-duping.
- Confirm My Skips and voted-take exclusions cannot leak through warm cache.
- Keep user submissions out of duplicate rejection; moderation screens safety, not originality.

Definition-of-done candidates:

- New generated content feels more human and less templated.
- Same-topic clusters are rarer within a session.
- Voted/skipped IDs are excluded from warm cache and live fetch paths.
- `generateTakes` duplicate guard remains stricter than normal user submissions.
- The feed has an explainable freshness/shuffle strategy instead of an accidental ordering smell.
- No new native dependencies.

### 2. Core Loop Reliability V2

**Deploy path**: OTA.

**Why**: The app can be feature-rich, but one stuck card makes the whole thing feel amateur. This is still the most important quality bar.

Scope ideas:

- Audit the card state machine around freeze, promotion, results reveal, and dismiss.
- Make stuck cards self-healing with a timeout/reset path.
- Keep UI animations fully decoupled from Firestore, outbox, ads, and prefetch work.
- Audit all `runAfterInteractions`, timeouts, and post-vote side effects.
- Add lightweight instrumentation for local testing only if it helps diagnose snags.
- Keep the card deck deterministic enough that the next card never visibly changes after it is revealed.

### 3. Feed Filtering Robustness

**Deploy path**: OTA/backend depending on implementation.

**Why**: The intended rule is simple: voted takes never return; skipped takes never return to the main feed. The implementation is currently hybrid local cache + Firestore, so edge cases need tightening.

Scope ideas:

- Persist local interacted IDs earlier and more atomically.
- Include both voted and skipped IDs in every warm-cache read.
- Consider a server-authoritative `users/{userId}/interactions` mirror or compact hash set if Firestore query costs stay reasonable.
- Reconcile vote outbox and local hidden IDs on app start.
- Keep My Skips as the only intentional path back to skipped takes.
- Decide how long local interacted history should persist if a user clears app data.

### 4. Quest Depth and Payoff

**Deploy path**: OTA.

**Why**: Quests work, but they should feel more like playful session fuel than chores.

Scope ideas:

- More quest variants:
  - Take the unpopular side 3 times.
  - Vote on 3 close-call takes.
  - Vote in 3 different categories.
  - Vote on fresh takes with fewer than 10 votes.
  - Revisit Vote History.
  - Clear 5 skipped takes.
  - Save or share one result.
- Better completion moment and copy variety.
- Quest tie-ins to My Voting Style.
- Quest history only if it creates motivation.
- Rewards should stay cosmetic/identity-based, not pay-to-win.

### 5. Results Share Card 2.0

**Deploy path**: OTA for share-card polish; backend/web if adding public OG pages.

**Why**: Sharing should tell a story, not just show numbers.

Scope ideas:

- Sharper visual share card for close calls, landslides, and contrarian moments.
- Use result reaction headline as share lead.
- Stronger CTA when user is in a small minority.
- Public web/OG page per take or per result if we want rich previews.
- Preserve one-tap native share behavior.

Example copy:

- "Only 12% agreed with me on this one."
- "The room split 51/49."
- "I took the unpopular side."
- "Almost everyone said HOT."

### 6. Store Screenshots and Listing Refresh

**Owner**: Michael
**Deploy path**: Store metadata, not app code.

**Why**: Conversion is free growth. The app now looks much better than old store assets probably show.

Suggested screenshot story:

1. Vote HOT or NOT on spicy takes.
2. See how the community voted.
3. Discover your voting style.
4. Keep your daily quest/streak alive.
5. Revisit skipped takes and vote history.
6. Browse Hottest, Nottest, Divisive, and Skipped.
7. Submit your own take after moderation.

## OTA Eligible Backlog

These should be possible without app store review if implemented with current dependencies and backend shape.

### Core Loop and Results

- Harden card freeze/promotion/result-dismiss behavior.
- More reaction headline variants.
- More nuanced rare-contrarian visual treatment.
- Better result-card share copy.
- Continue tuning results-card exit and next-card handoff.
- Keep Results Autoplay default off unless user behavior suggests otherwise.
- Keep haptics conservative; reintroduce only after device-tested proof.

### Feed Quality

- Better session-level de-duping.
- Better warm-cache filtering against voted/skipped IDs.
- Better "All Categories" ordering.
- My Skips count badge in category picker.
- Recency/topic diversity controls.
- Reconciliation logic that never visibly swaps a card the user already saw.

### AI Content Quality

- Reduce semicolon frequency.
- More sentence rhythm variety.
- Avoid generic filler.
- Avoid overusing the same topic frame.
- Add near-duplicate checks.
- Add category-fit validation.
- Keep generated takes opinionated, human-feeling, and debatable.
- Add quality-audit scripts for generated corpus review.

### Personal Identity

- More voting-style titles and thresholds.
- Weekly recap: "Your voting week."
- Category personality summaries.
- "You surprised the room" moments.
- "You agree with the crowd" milestone copy.
- Lightweight achievements screen if the toast-only system starts feeling too hidden.

### History and Revisit Surfaces

- Vote History filters by category, vote type, or close-call status.
- Search within Vote History.
- One-tap "clear this skipped take" behavior if needed.
- Better empty states for History, Favorites, My Takes, and My Skips.

### Leaderboards and Discovery

- Better cached leaderboard freshness indicators.
- Trending takes based on recent vote velocity.
- Fresh debates.
- Category-specific tabs or chips.
- More visual hierarchy in rows.
- Backfill or repair `hotPercentage`/`notPercentage` for older takes if rules allow.

### Safety and Trust

- Improve report confirmation copy.
- Admin/review helper script for reported takes.
- Periodic content scans for profanity, CSAE terms, and obvious policy violations.
- Keep safety standards URL functional and app/developer-name aligned.
- Keep fail-closed moderation behavior.

### Growth Without Native Changes

- Store description refresh.
- Share-copy experiments.
- Referral copy if using existing share primitives only.
- Invite & Review copy tweaks.

## Full Release Required Backlog

These likely need new native permissions, native configuration, new native dependencies, or store review.

### Remote Notifications and Native Engagement

- Push notifications for server-triggered streak reminders, daily quests, or trending takes.
- APNs and FCM remote notification setup.
- iOS Live Activities for streaks or daily quests.
- iOS home screen widget showing a daily take.
- Android widgets or quick tiles.

### Native Sharing and Platform Features

- New share sheet targets or behavior requiring native configuration.
- iMessage stickers.
- SharePlay or group voting sessions.
- New deep-linking behavior if native config changes are required.

### Ads and Monetization

- New AdMob ad formats.
- Native ad placement changes that require configuration.
- Subscription or in-app purchase support.
- Ad-free premium tier.
- Significant ATT/consent flow changes.

### Authentication and Permissions

- OAuth login with Apple, Google, or other providers.
- Contacts-based friend discovery.
- Photo library or camera access for avatars.
- Cross-device account sync that requires native auth setup.

## Either Path Depending on Implementation

### User Profiles

- **OTA path**: Anonymous-first profile with display name, local avatar choice, and basic stats.
- **Full release path**: OAuth login, photo upload, cross-device identity, or new native permissions.

### Achievements System

- **OTA path**: Display-only achievements calculated from existing Firestore stats.
- **Backend path**: Cloud Functions for authoritative achievement awarding or anti-abuse controls.
- **Full release path**: Native notifications or background processing.

### Friends and Leaderboards

- **OTA path**: Firestore-based friend code or public profile links with no contacts permission.
- **Full release path**: Contacts import, push notifications, or deep native integrations.

### Results Share 2.0

- **OTA path**: Improve existing share button copy, share card, and trigger timing.
- **Backend/web path**: Add public OG pages for individual shared results.
- **Full release path**: Add or configure new native share targets.

## Longer-Term Product Ideas

### Profiles and Accounts

- Username and avatar while staying anonymous-first.
- Optional bio/tagline.
- Stats display: votes cast, takes submitted, streak, favorite categories.
- Badge collection showcase.
- Favorite takes collection.
- Cross-device sync if accounts become worth the complexity.

### Social Graph

- Follow other users, opt-in only.
- Friends leaderboard.
- Share takes directly to followers.
- Private groups for voting competitions.
- Referral rewards for inviting friends.

### Content Discovery

- Personalized "For You" feed based on voting patterns.
- Trending takes algorithm.
- Category deep dives.
- Time machine: browse takes from a date or season.
- Regional takes only if location/privacy tradeoffs are worth it.

### AI and Content Features

- AI take suggestions for users drafting submissions.
- Smart category recommendations.
- AI-powered take battles.
- Sentiment and quality analysis for moderation/admin review.
- Topic freshness controls so generated content reflects current culture without becoming news-dependent.

### Monetization

- Advanced statistics.
- Exclusive themes or badge designs.
- Priority moderation for submitted takes.
- Virtual currency only if it does not become pay-to-win.

## Things We Are Not Doing By Default

- Requiring real names.
- Adding direct messaging without a major safety review.
- Adding contacts permission casually.
- Pay-to-win voting mechanics.
- Intrusive data collection.
- Political bias in algorithms.
- Client-side OpenAI calls or exposed AI keys.
- Auto-approving content when moderation fails.
- Adding native permissions without a clear product reason.
- Adding haptics casually after the iOS clunkiness lesson.

## Backlog Hygiene

- Keep this file focused on product possibilities and sprint candidates.
- Move durable operating knowledge into `CLAUDE.md`.
- Keep historical launch notes in `docs/archive/`.
- Keep deploy-path labels current before each sprint.
- Mark completed work as current baseline instead of leaving it in the future list.
- Before implementing any full-release-required feature, confirm store review and permission implications first.
