# Feed Behavior Spec

This document names the current feed contract for Hot or Not Takes. Treat it as
product behavior, not incidental implementation detail.

## Source Of Truth

Runtime feed behavior currently lives in:

- `src/hooks/useFirebaseTakes.ts`
- `src/services/takeService.ts`
- `src/utils/feedOrdering.ts`
- `src/constants/categories.ts` for the `My Skips` category identity

`CLAUDE.md` is the operating guide. This spec is the narrower reference for feed
rules and should be updated whenever the rules below change.

## Feed Ownership

`useFirebaseTakes` owns the user-facing deck:

- Initial feed hydration
- Local feed cache reads/writes
- Vote and skip removal from the current deck
- Reconciliation with server-side voted/skipped IDs
- Pagination through `fetchMoreTakesFilled`
- Background generation when the visible normal-feed pool is low
- `My Skips` retrieval and local hiding

`takeService` owns Firestore fetches and writes used by the hook. It should not
decide presentation order beyond returning eligible pages and starter-deck
candidates.

## Eligibility Rules

A take is eligible for the normal feed only when all of these are true:

- It is approved: `isApproved === true` or `status === 'approved'`.
- The user has not voted on it.
- The user has not skipped it.
- The take is not queued for a local/offline vote write.
- The take is not hidden in the current session.
- Its text fingerprint is not a duplicate of another take already in the deck or
  recent session history.
- If a category is selected, the take belongs to that category.

Skipped takes are intentionally excluded from normal gameplay. They should only
reappear in the `My Skips` category or in non-feed surfaces such as analytics,
leaderboards, history, favorites, admin, and audit tooling where appropriate.

## My Skips

`My Skips` is a deliberate review lane, not part of the normal feed.

- It loads from the user's skip records.
- Takes the user later voted on are excluded.
- Local session hides remove items from this lane without changing the historical
  skip record.
- `hasMore` is false in this lane; it is not a paginated discovery feed.
- Voting on a skipped take removes it from the `My Skips` cache and local skipped
  ID list.

## Initial Load

On user or category change, the hook:

1. Resets the feed cursor for the category.
2. Reads local voted IDs, local skipped IDs, queued vote IDs, and user stats.
3. Uses local IDs immediately so stale cached takes do not flash back into view.
4. Optionally renders a valid local cache first.
5. Reconciles with server-side voted/skipped IDs.
6. Loads fresh approved takes, plus starter-deck takes when the user is still in
   the starter-deck vote window.
7. Deduplicates by ID and normalized text.
8. Orders the result for freshness and writes the refreshed cache.

If cached content is rendered first, the visible deck is preserved during live
reconciliation as much as possible so cards do not jump under the user.

## Ordering Rules

The feed ordering target is variety with stability.

- Established community takes receive a soft random weight based on vote count.
- Active deprioritized takes go to the back of the deck and are used only after
  normal takes.
- Starter-deck takes are prioritized while the user's total vote count is below
  `STARTER_DECK_PRIORITY_TOTAL_VOTE_LIMIT`.
- In the `all` category, adjacent category repeats are avoided when possible.
- Recently seen similar text is avoided using normalized text fingerprints and
  character-trigram similarity.
- Visible cards are kept stable during background refreshes; only the tail should
  reshuffle.

## Cache Rules

Feed cache is local, per user, per category, versioned, and time-limited.

- Cache key: `feed-cache:v1:{userId}:{category}`.
- TTL: 6 hours.
- Max stored deck size: 30 takes.
- Only approved takes are written.
- Hidden IDs are applied while reading cache.
- Empty approved cache writes remove the cache entry.

The local voted/skipped ID caches are also versioned and are used as an immediate
trust layer before slower server reconciliation completes.

## Vote Rules

Voting is optimistic:

- Duplicate in-flight votes for the same take are ignored.
- The take is immediately hidden from the current deck and current session.
- A vote write is enqueued through `voteOutboxService`.
- The local voted ID list is updated.
- If the take was previously skipped, it is removed from the local skipped list
  and from the `My Skips` feed cache.
- When the deck gets low, a delayed `loadMore` runs after interactions finish.

Vote errors are handled without crashing the UI; local in-flight/session state is
rolled back where the hook can safely do so.

## Skip Rules

Skipping is user-specific and optimistic:

- The take is removed from the current deck immediately.
- In the normal feed, the take is added to the local skipped ID list.
- In the normal feed, the skipped take is prepended into the `My Skips` cache.
- The skip is recorded in Firestore for analytics and `My Skips` retrieval.
- Skip write failures are surfaced as skip failures in the hook.
- In `My Skips`, skipping only hides the take from that review lane for the
  current session.

## Background Generation

The client asks the server to generate more takes only when:

- The user is signed in.
- The hook is not loading.
- The user is not viewing `My Skips`.
- The normal, non-deprioritized visible feed count is `3` or fewer.
- Generation is not already in flight for the same user/category key.

When generation adds content, the category cursor resets and the hook loads more
behind the first visible cards. Generation failures are intentionally swallowed;
the user should not see an error or spinner because background generation failed.

## Deprioritization

Deprioritized takes remain approved inventory. They are not deleted and are still
valid for non-feed surfaces. In the normal feed, active deprioritized takes are
ranked after normal takes and should function as last-resort inventory when a
category is thin.

## Change Guardrails

Before changing feed behavior:

1. Identify whether the change affects eligibility, ordering, caching, voting,
   skipping, generation, or `My Skips`.
2. Update this spec in the same change when product behavior changes.
3. Run `npx tsc --noEmit`.
4. Manually smoke-test normal feed, a category feed, skip behavior, vote removal,
   and `My Skips`.
5. For ranking/deprioritization changes, verify that approved-but-deprioritized
   takes remain available only as intended fallback inventory.

## Open Follow-Ups

- Add focused tests for feed eligibility and cache filtering.
- Audit whether `fetchMoreTakesFilled` should know about active
  deprioritization, or whether all deprioritization should remain a presentation
  ordering concern in the hook.
- Decide whether starter-deck priority should be represented in product copy so
  new users understand why early cards may feel curated.
