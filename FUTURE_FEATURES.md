# Future Features Backlog - Hot or Not Takes

**Updated**: June 15, 2026
**Status**: Living product backlog
**Purpose**: Capture product ideas, deployment constraints, and likely sprint candidates. This is not a promise list; it is the place to keep good ideas warm until they are scoped.

Hot or Not Takes is now a production app with server-side moderation, AI-generated endless feed support, daily streak basics, in-app safety reporting, and a more polished swipe loop. Future work should make the existing loop more rewarding before adding heavy new surfaces.

## Product Principles

- **Strengthen the core loop first**: Swipe, reveal, react, repeat.
- **Make the app feel purpose-built**: Motion, copy, spacing, feedback, and surfaces should cohere as deliberate product choices, not leftover vibe-code.
- **Prefer OTA improvements**: Ship JavaScript-only polish and retention features quickly when possible.
- **Make every vote feel alive**: Results should feel like a social reveal, not just a stat panel.
- **Make launch feel instant**: Returning users should see a take quickly, not a skeleton every time.
- **Build identity before comparison**: Personal stats and taste profiles should come before heavier global ranking mechanics.
- **Keep onboarding obvious**: New users should understand HOT, NOT, and skip without hunting through menus.
- **Protect store trust**: Safety, moderation, child-safety standards, and store metadata are product features, not chores.
- **Stay anonymous-friendly**: Do not force real names or full accounts unless the value is obvious.

## North Star Metric

**Weekly Active Voters (WAV)** is the primary product metric.

The app wins when people come back and vote again. Total downloads, total takes, and total votes are useful, but Weekly Active Voters best captures whether Hot or Not Takes is becoming a repeat habit.

Supporting metrics:
- Votes per active user.
- Votes per session.
- D1 and D7 retention.
- Daily challenge completion rate.
- Streak continuation rate.
- Share taps and completed shares.
- Report volume and moderation pending volume.

## Churn Risks

Known or likely reasons users may leave:

- Cold starts feel slow because users see skeleton loading before cards appear.
- New users may not immediately understand swipe direction, skip gestures, or the results reveal.
- Low perceived community size can make the app feel less alive than it is.
- Results can become predictable if too many takes are obvious consensus opinions.
- AI-generated phrasing can feel repetitive, especially semicolon-heavy writing.
- Weak personal investment if the app does not reflect the user's taste, identity, or voting history back to them.
- Empty states can feel broken rather than intentional.
- Disconnected polish can make the app feel assembled rather than intentionally designed.

## Recommended Next OTA Sprint

### 1. Warm-Start Feed Cache
- Cache a small batch of approved, unvoted takes locally after a successful feed load.
- On app launch, render cached takes immediately while Firestore refreshes in the background.
- Cache should be scoped by user and category.
- Filter cached takes against known voted IDs before display when possible.
- Use a simple TTL so stale content does not live forever.
- Fall back to skeleton only when no usable cache exists.

### 2. Daily Challenge
- Add a daily challenge such as "Vote on 20 takes today."
- Show progress near the existing streak/vote stats area.
- Support simple variants over time:
  - Vote on 20 takes today.
  - Vote on 10 takes in a category.
  - Vote on 5 divisive takes.
- Completion should trigger a satisfying toast or lightweight celebration.

### 3. Reveal Moment / Controversy Engine
- Treat the results card as the emotional core of the app.
- Add contextual copy to the results card after a vote.
- Example lines:
  - "You're in the minority."
  - "Most people agree with you."
  - "This one split the room."
  - "Certified heater."
  - "Ice cold take."
  - "The room is divided."
- Highlight surprising vote moments:
  - "Only 8% agreed with you."
  - "You went against the crowd."
  - "Almost nobody took your side."
- Keep lines short, varied, and tied to vote percentages.

### 4. Personal Taste Profile
- Generate a lightweight identity from existing vote history.
- No login required; anonymous user data is enough.
- Possible labels:
  - Contrarian
  - Crowd Follower
  - Chaos Agent
  - Category Loyalist
  - Optimist
  - Skeptic
  - Sports Purist
  - Food Critic
- Start as a teaser or compact stats card before building a full profile surface.

### 5. Personal Stats Before Global Leaderboards
- Reflect the user's behavior back to them.
- Example stats:
  - "You agree with the crowd 72% of the time."
  - "Food is your hottest category."
  - "You vote NOT more often than most users."
  - "You love close-call takes."
- Personal identity should take priority over global ranking polish.

### 6. Vote History
- Make previous votes revisitable instead of limiting the user to a tiny recent slice.
- Use pagination or "Load more" rather than loading every vote at once.
- Let users revisit takes, see current community split, share later, and change votes when supported.
- Treat history as a foundation for personal stats and taste profile.

### 7. Core Loop Enrichment Pass
- Audit the main gameplay loop as a single intentional experience:
  - App launch
  - First visible card
  - Swipe gesture
  - Vote feedback
  - Results reveal
  - Save/share/change-vote actions
  - Return to the next card
- Tune motion, haptics cadence, copy, spacing, card texture, and transition timing so the loop feels rich and coherent.
- This is not a redesign; it is an intentionality pass over the product's most important seconds.

### 8. Empty State and Loading Polish
- Better no-feed card: "You've seen everything in this category. More takes are on the way."
- Show community vote count or streak encouragement instead of blank space.
- Keep skeleton/loading states calm and consistent.

## OTA Eligible Ideas

These should be possible without app store review if implemented with existing dependencies and Firestore/Cloud Functions already in place.

### Launch and Feed Performance
- Warm-start feed cache so returning users see cards immediately on launch.
- Persist the latest usable batch of approved takes locally after successful feed loads.
- Store cache by user ID and selected category.
- Filter out cached takes the user has already voted on when local interaction history is available.
- Refresh from Firestore in the background and reconcile the deck without a jarring card swap.
- Use skeleton loading only for first launch, empty cache, or expired cache.
- Keep cache TTL simple at first, likely 6-24 hours.
- Treat this as high-priority perceived-quality work.

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

### Reveal Moment and Gameplay Feel
- Post-vote personality lines based on percentage split.
- Better result reveal copy for landslides, close calls, and unpopular votes.
- Controversy engine moments:
  - "91% HOT, you voted NOT."
  - "Only 8% agreed with you."
  - "You took the unpopular side."
  - "This one split the room."
- Most surprising votes list based on the user's vote differing sharply from the crowd.
- Encourage screenshots/shares when a result is unusually surprising.
- More natural results-card transitions as needed.
- More consistent button states and disabled states.
- Fine-tune skip/recent-vote affordances based on observed testing.
- Dedicated core loop enrichment pass so swipe, reveal, result, and next-card transitions feel like one purpose-built experience.

### Personal Stats and Taste Profile
- Build personal stats from existing vote history before investing heavily in global leaderboards.
- Possible stats:
  - Crowd agreement percentage.
  - HOT vs NOT tendency.
  - Hottest/coldest personal category.
  - Most contrarian category.
  - Number of close-call votes.
- Possible taste labels:
  - Contrarian
  - Crowd Follower
  - Chaos Agent
  - Category Loyalist
  - Optimist
  - Skeptic
  - Sports Purist
  - Food Critic
- Start with a compact card or toast, then graduate to a profile surface if users respond.

### Vote History
- Keep Vote History paginated, newest first.
- Show vote choice, category, current community split, and take text.
- Let users revisit a take/results view from history.
- Preserve "change your vote" behavior where the existing vote system supports it.
- Use history as a bridge to personal stats, taste profile, and later sharing moments.

### Feed and Category Experience
- Better empty feed state.
- Better favorites empty state.
- Better vote history empty state.
- Category stats in the category picker, such as overall HOT percentage or vote count by category.
- Alphabetized category ordering should remain enforced.
- Continue auditing category miscategorizations when AI generation creates odd placements.
- Keep the "all" category balanced by generating under-supplied categories first.

### Leaderboards and Discovery
- Treat global leaderboards as secondary to personal stats until the community feels larger.
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
- Weekly Active Voters (north star).
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
