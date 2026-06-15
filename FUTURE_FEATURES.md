# Future Features Backlog - Hot or Not Takes

**Updated**: June 15, 2026
**Status**: Living product backlog
**Purpose**: Capture product ideas, deployment constraints, and likely sprint candidates. This is not a promise list; it is the place to keep good ideas warm until they are scoped.

Hot or Not Takes is now a production app with server-side moderation, AI-generated endless feed support, daily streak basics, in-app safety reporting, and a more polished swipe loop. Future work should make the existing loop more rewarding before adding heavy new surfaces.

## Product Principles

- **Strengthen the core loop first**: Swipe, reveal, react, repeat.
- **Prefer OTA improvements**: Ship JavaScript-only polish and retention features quickly when possible.
- **Make every vote feel alive**: Results should feel like a social reveal, not just a stat panel.
- **Keep onboarding obvious**: New users should understand HOT, NOT, and skip without hunting through menus.
- **Protect store trust**: Safety, moderation, child-safety standards, and store metadata are product features, not chores.
- **Stay anonymous-friendly**: Do not force real names or full accounts unless the value is obvious.

## Recommended Next OTA Sprint

### 1. Daily Challenge
- Add a daily challenge such as "Vote on 20 takes today."
- Show progress near the existing streak/vote stats area.
- Support simple variants over time:
  - Vote on 20 takes today.
  - Vote on 10 takes in a category.
  - Vote on 5 divisive takes.
- Completion should trigger a satisfying toast or lightweight celebration.

### 2. Post-Vote Personality
- Add contextual copy to the results card after a vote.
- Example lines:
  - "You're in the minority."
  - "Most people agree with you."
  - "This one split the room."
  - "Certified heater."
  - "Ice cold take."
  - "The room is divided."
- Keep lines short, varied, and tied to vote percentages.

### 3. Leaderboard Polish
- Make leaderboard feel like the app's "what's happening" screen.
- Candidate sections:
  - Hottest takes
  - Coldest takes
  - Most divisive
  - Most skipped
  - Fresh debates
- Improve empty/error states so Firestore permission gaps never feel broken to users.

### 4. Empty State and Loading Polish
- Better no-feed card: "You've seen everything in this category. More takes are on the way."
- Show community vote count or streak encouragement instead of blank space.
- Keep skeleton/loading states calm and consistent.

## OTA Eligible Ideas

These should be possible without app store review if implemented with existing dependencies and Firestore/Cloud Functions already in place.

### Retention and Reward
- Daily challenges.
- Category-specific daily challenges.
- Streak milestone toasts beyond the current streak counter.
- "Vote to keep your streak" nudge banner.
- "You're on fire" session moment after a user votes on several takes in one session.
- Lightweight achievement notifications with no new native permissions.
- Achievement-lite milestones:
  - First 10 votes
  - 100 votes
  - 1,000 votes
  - First streak
  - 7-day streak
  - Voted in every category
  - Took the unpopular side

### Results and Gameplay Feel
- Post-vote personality lines based on percentage split.
- Better result reveal copy for landslides, close calls, and unpopular votes.
- More natural results-card transitions as needed.
- More consistent button states and disabled states.
- Fine-tune skip/recent-vote affordances based on observed testing.

### Feed and Category Experience
- Better empty feed state.
- Better favorites empty state.
- Better recent votes empty state.
- Category stats in the category picker, such as overall HOT percentage or vote count by category.
- Alphabetized category ordering should remain enforced.
- Continue auditing category miscategorizations when AI generation creates odd placements.
- Keep the "all" category balanced by generating under-supplied categories first.

### Leaderboards and Discovery
- Most divisive takes.
- Fresh debates.
- Trending takes based on recent voting velocity.
- Category-specific leaderboard filters.
- More visual hierarchy and clearer labels in leaderboard rows.
- Lightweight pull-to-refresh polish.

### Sharing and Virality
- Polish the existing share button on the results card.
- Improve generated share card copy and visual hierarchy.
- Add stronger calls to action after a surprising result.
- Consider shareable stats cards:
  - "I voted with 12% of people."
  - "This take split the room 51/49."
- No new native share targets unless required.

### Onboarding and First Session
- First-launch swipe tutorial or instruction card.
- Make HOT, NOT, and skip gestures clear in the first minute.
- Consider a short guided first vote rather than a separate explanatory screen.
- Keep instructions screen swipeable, since page dots imply swipe.

### Copy and UX Tweaks
- Tone pass on all user-facing strings.
- Reduce intimidating punctuation in AI-generated takes, especially semicolons.
- Keep submit copy aligned with moderation reality.
- Keep safety/reporting copy aligned with the menu-based reporting flow.

### AI Content Quality
- Reduce semicolon frequency in generated takes.
- Increase sentence rhythm variety.
- Avoid generic filler.
- Avoid overuse of the same topics or framing.
- Improve duplicate and near-duplicate detection.
- Improve category fit checks.
- Keep generated takes opinionated, human-feeling, and debatable.
- Continue using server-side moderation before generated takes are written.

### Growth Without Native Changes
- Store screenshot refresh planning and copywriting.
- App Store / Google Play listing copy updates.
- Review prompt via a simple link if native in-app review support is not already available.
- A/B wording ideas for screenshots and store descriptions.

## Full Release Required Ideas

These likely need new native permissions, native configuration, new native dependencies, or store review.

### Notifications and Native Engagement
- Push notifications for streak reminders, daily challenges, or trending takes.
- APNs and FCM setup.
- iOS Live Activities for streaks or daily challenges.
- iOS home screen widget showing a daily take.
- Android widgets or quick tiles.

### Native Sharing and Platform Features
- New share sheet targets or behavior that requires native configuration.
- iMessage stickers.
- SharePlay or group voting sessions.
- New deep-linking behavior if native config changes are required.

### Ads and Monetization
- Any new AdMob ad format.
- Native ad placement changes that require configuration.
- Subscription or in-app purchase support.
- Significant ATT/consent flow changes.

### Authentication and Permissions
- OAuth login with Apple, Google, or other providers if native setup is required.
- Contacts-based friend discovery.
- Photo library or camera access for avatars.
- Any new permission prompt.

## Either Path Depending on Implementation

### User Profiles
- **OTA path**: Anonymous-first profile with display name, local avatar choice, basic stats, and Firestore-backed history.
- **Full release path**: OAuth login, photo upload, cross-device identity, or new native permissions.

### Achievements System
- **OTA path**: Display-only achievements calculated from existing Firestore stats.
- **Backend path**: Cloud Functions for authoritative achievement awarding or anti-abuse controls.
- **Full release path**: Native notifications or background processing.

### Friends and Leaderboards
- **OTA path**: Firestore-based public/friends code leaderboard with no contacts permission.
- **Full release path**: Contacts import, push notifications, or deep native integrations.

### Review Prompt
- **OTA path**: Simple "Rate us" link after a positive moment.
- **Full release path**: Native in-app review prompt if the required module/config is not already present.

### Share Improvements
- **OTA path**: Improve existing share button copy, share card, and trigger timing.
- **Full release path**: Add or configure new native share targets.

## Strategic Growth Tasks

### Store Screenshots
- Current screenshots should be treated as a growth opportunity.
- Better screenshots can improve install conversion without changing the app.
- Suggested screenshot story:
  1. Vote HOT or NOT on spicy takes.
  2. See how the community voted.
  3. Keep your daily streak alive.
  4. Browse the hottest, coldest, and most divisive takes.
  5. Submit your own take after AI moderation.
- Include both light and dark mode if the store slots allow it.

### Review Strategy
- Prompt only after a positive moment:
  - Daily challenge complete.
  - Streak milestone.
  - Several votes in one session.
  - A fun results reveal.
- Do not prompt on first launch or immediately after errors/rejections.

### Metrics to Watch
- D1 retention.
- D7 retention.
- Votes per session.
- Sessions per user per day.
- Challenge completion rate.
- Streak continuation rate.
- Share taps and completed shares.
- Store page conversion after screenshot refresh.
- Report volume and moderation failure/pending volume.

## Longer-Term Product Ideas

### User Profiles and Accounts
- Username and avatar while staying anonymous-first.
- Optional bio/tagline.
- Stats display: votes cast, takes submitted, streak, favorite categories.
- Badge collection showcase.
- Favorite takes collection.
- Optional take history.
- Cross-device sync if accounts become worth the complexity.

### Badges and Levels
- Bronze/Silver/Gold voter levels.
- Category badges such as Food Critic, Tech Guru, Sports Analyst.
- Event badges for holiday or trending-topic takes.
- Rare badges for surprising achievements.
- Badge showcase on profiles.

### Favorites and Collections
- Keep starring/bookmarking takes.
- Create collections such as "Wild Food Takes" or "Controversial Politics."
- Public/private collection toggle.
- Share collections.
- Trending collections discovery.

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
- Unlimited skips.
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

## Backlog Hygiene

- Move completed ideas into `CLAUDE.md` only when they change current operating behavior.
- Keep historical launch notes in `docs/archive/`.
- Keep deploy-path labels current before each sprint.
- Before implementing any "full release required" feature, confirm the store review and permission implications first.
