# Future Features Backlog - Hot or Not Takes

**Updated**: June 16, 2026
**Status**: Living product backlog
**Purpose**: Capture product ideas, deploy constraints, and likely sprint candidates. This is not a promise list; it is where good ideas stay warm until they are scoped.

Hot or Not Takes is a production app with server-side moderation, AI-generated feed refill, warm-start feed cache, daily quests, vote history, My Skips, in-app safety reporting, cached leaderboards, and a much richer core swipe loop. Future work should make the loop more personally rewarding before adding heavy new surfaces.

## Product Principles

- **Strengthen the core loop first**: Swipe, reveal, react, repeat.
- **Make every vote feel alive**: Results should feel like a social reveal, not just a stat panel.
- **Build identity before comparison**: Personal stats and taste profiles should come before heavier global ranking mechanics.
- **Protect flow speed**: Menus, card transitions, cache reads, and result reveals should feel instant or intentionally animated.
- **Prefer OTA improvements**: Ship JavaScript-only polish and retention features quickly when possible.
- **Keep onboarding obvious**: New users should understand HOT, NOT, skip, results, and daily quests without hunting.
- **Protect store trust**: Safety, moderation, child-safety standards, and store metadata are product features.
- **Stay anonymous-friendly**: Do not force real names or full accounts unless the value is obvious.
- **Make AI invisible in the right way**: AI content should feel human, varied, and category-appropriate.

## Current Product Baseline

These are no longer future ideas; they are part of the working product foundation.

- Server-side moderation through Firebase Cloud Functions; OpenAI key stays off the client.
- Cloud Function AI generation refills under-supplied categories and avoids obvious duplicates.
- Client feed warm-start cache renders returning users into cards quickly.
- Feed filtering respects voted and skipped takes; My Skips lets users revisit skipped takes.
- Vote History is the primary history surface, replacing the old last-10 Recent Votes model.
- Results card has dynamic reaction copy, percentage count-up, Save, Share result, Change vote, and Results Autoplay preference.
- Daily quest system supports vote count, category votes, fresh takes, divisive takes, and multi-category quests.
- Achievement-lite toasts exist for vote count, streak, and all-category milestones.
- Footer stats expose streak, daily quest, and community votes with tap-to-explain nudges.
- Leaderboards include Hottest, Nottest, Divisive, and Skipped, with local cache/prefetch.
- Dark mode preference persists.
- In-app safety/reporting standards exist through the menu flow.
- Store child-safety standards are published externally and reflected in app content.

## North Star Metric

**Weekly Active Voters (WAV)** is the primary product metric.

The app wins when people come back and vote again. Total downloads, total takes, and total votes are useful, but Weekly Active Voters best captures whether Hot or Not Takes is becoming a repeat habit.

Supporting metrics:

- Votes per active user.
- Votes per session.
- D1 and D7 retention.
- Daily quest completion rate.
- Streak continuation rate.
- Share taps and completed shares.
- Vote History opens.
- My Skips opens and skipped-take conversions.
- Report volume and moderation pending volume.
- Store page conversion after screenshot refresh.

## Current Risks

- **First-session clarity**: The app is more polished now, but brand-new users may still need a clearer first minute.
- **Perceived community size**: Small vote counts can make a take feel less alive unless copy frames it well.
- **AI repetition**: Generated content can still overuse certain phrasing, punctuation, or topics.
- **Duplicate/near-duplicate fatigue**: Users noticing similar takes will erode trust that their votes matter.
- **Haptic sensitivity**: iOS haptics can feel mistimed or blocking; keep haptics conservative unless tested on real devices.
- **Menu responsiveness**: Utility surfaces must open instantly; any lag makes the app feel heavier than it is.
- **Firestore rules drift**: Vote percentage denormalization currently needs rules/backfill care so Divisive data stays reliable.
- **Store release friction**: Android/iOS builds, OTA compatibility, and service-account automation should be kept healthy.

## Recommended Next OTA Sprint Candidates

### 1. Personal Stats and Taste Profile

**Why**: This is the most natural next retention layer. The app already has vote history, categories, crowd splits, and results reactions. Now it should reflect the user's identity back to them.

Scope ideas:

- Crowd agreement percentage: "You agree with the room 68% of the time."
- HOT vs NOT tendency.
- Favorite/hottest/coldest personal categories.
- Contrarian category: "Politics is where you break from the crowd."
- Close-call voter: "You keep landing on split-room takes."
- Lightweight labels:
  - Contrarian
  - Crowd Follower
  - Chaos Agent
  - Category Loyalist
  - Optimist
  - Skeptic
  - Food Critic
  - Sports Purist

Start with a compact stats card or result-card teaser before building a full profile screen.

### 2. Results Share Card 2.0

**Why**: The results card is the emotional core. Sharing should feel like sharing a story, not a table of numbers.

Scope ideas:

- Sharper visual share card for close calls, landslides, and contrarian moments.
- Use result reaction headline as share lead.
- Stronger CTA when user is in a small minority.
- Preserve one-tap native share behavior.
- Avoid new native share targets unless truly needed.

Example copy:

- "Only 12% agreed with me on this one."
- "The room split 51/49."
- "I took the unpopular side."
- "Almost everyone said HOT."

### 3. First-Session Onboarding

**Why**: The app is simple once understood, but the first minute determines whether new users get to the good part.

Scope ideas:

- First-launch guided card or lightweight tutorial.
- Show HOT, NOT, and skip affordances before the user needs them.
- Explain the results reveal after the first vote.
- Keep the existing Instructions screen swipeable, but do not rely on it for first-session comprehension.
- Avoid a marketing-style landing page; drop users into gameplay quickly.

### 4. Store Screenshots and Listing Refresh

**Why**: Conversion is free growth. The app now looks much better than old store assets probably show.

Suggested screenshot story:

1. Vote HOT or NOT on spicy takes.
2. See how the community voted.
3. Keep your daily quest/streak alive.
4. Revisit skipped takes and vote history.
5. Browse Hottest, Nottest, Divisive, and Skipped.
6. Submit your own take after moderation.

Include both light and dark mode if store slots allow it.

### 5. Feed Quality and Duplicate Defense

**Why**: The endless feed only works if users believe they are seeing fresh takes and that votes/skips count.

Scope ideas:

- Improve near-duplicate detection beyond exact text/fingerprint.
- Add small admin script for scanning repeated topics/phrases.
- Track AI source prompts/categories for quality audits.
- Keep semicolon use low in generation prompts.
- Continue correcting category drift.
- Consider lightweight recency/topic diversity controls.

### 6. Quest and Achievement Depth

**Why**: Daily quests are a strong first pass. They need variety, clarity, and better emotional payoff.

Scope ideas:

- More quest variants:
  - Take the unpopular side 3 times.
  - Vote on 3 close-call takes.
  - Revisit Vote History.
  - Clear 5 skipped takes.
  - Save or share one result.
- Better completion moment.
- Quest copy bank with more personality.
- Quest history or "yesterday's quest" only if it adds motivation.
- Rewards should stay cosmetic/identity-based, not pay-to-win.

### 7. Menu and Surface Performance

**Why**: The main game now feels strong. Secondary surfaces should feel equally snappy.

Scope ideas:

- Keep burger menu opening instant.
- Defer leaderboard prefetch and ad work away from first interactions.
- Reduce noisy ad re-render/log churn where possible.
- Profile slow surface opens on real Android and iOS devices.
- Keep overlay transitions consistent through `FullScreenOverlay`.

## OTA Eligible Backlog

These should be possible without app store review if implemented with current dependencies and backend shape.

### Core Loop and Results

- More reaction headline variants.
- More nuanced rare-contrarian visual treatment.
- Better result-card share copy.
- Continue tuning results-card exit and next-card handoff.
- Keep Results Autoplay default off unless user behavior suggests otherwise.
- Keep haptics conservative; reintroduce only after device-tested proof.

### Personal Identity

- Personal stats card.
- Taste profile label.
- Weekly recap: "Your voting week."
- Category personality summaries.
- "You surprised the room" moments.
- "You agree with the crowd" milestone copy.

### History and Revisit Surfaces

- Vote History filters by category, vote type, or close-call status.
- Search within Vote History.
- My Skips count badge in category picker.
- One-tap "clear this skipped take" behavior if needed.
- Better empty states for History, Favorites, My Takes, and My Skips.

### Leaderboards and Discovery

- Better cached leaderboard freshness indicators.
- Trending takes based on recent vote velocity.
- Fresh debates.
- Category-specific tabs or chips.
- More visual hierarchy in rows.
- Backfill or repair `hotPercentage`/`notPercentage` for older takes if rules allow.

### AI Content Quality

- Reduce semicolon frequency.
- More sentence rhythm variety.
- Avoid generic filler.
- Avoid overusing the same topic frame.
- Add near-duplicate checks.
- Add category-fit validation.
- Keep generated takes opinionated, human-feeling, and debatable.

### Safety and Trust

- Improve report confirmation copy.
- Admin/review helper script for reported takes.
- Periodic content scans for profanity, CSAE terms, and obvious policy violations.
- Keep safety standards URL functional and app/developer-name aligned.
- Keep fail-closed moderation behavior.

### Growth Without Native Changes

- Store screenshot copywriting.
- Store description refresh.
- Simple "Rate us" link after a positive moment.
- Share-copy experiments.
- Referral copy if using existing share primitives only.

## Full Release Required Backlog

These likely need new native permissions, native configuration, new native dependencies, or store review.

### Notifications and Native Engagement

- Push notifications for streak reminders, daily quests, or trending takes.
- APNs and FCM setup.
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

### Review Prompt

- **OTA path**: Simple "Rate us" link after a positive moment.
- **Full release path**: Native in-app review prompt if the required module/config is not already present.

### Share Improvements

- **OTA path**: Improve existing share button copy, share card, and trigger timing.
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

- Ad-free premium tier.
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

## Backlog Hygiene

- Keep this file focused on product possibilities and sprint candidates.
- Move durable operating knowledge into `CLAUDE.md`.
- Keep historical launch notes in `docs/archive/`.
- Keep deploy-path labels current before each sprint.
- Mark completed work as current baseline instead of leaving it in the future list.
- Before implementing any full-release-required feature, confirm store review and permission implications first.
