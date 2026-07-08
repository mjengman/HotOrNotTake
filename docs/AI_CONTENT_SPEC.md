# AI Content Spec

This document records the current AI-content pipeline and policy boundaries for
Hot or Not Takes. It should be updated whenever generation, moderation,
duplicate handling, deprioritization, or cleanup tooling changes.

## Source Of Truth

Live AI generation and moderation live in `functions/src/index.ts`.

Client files must not call OpenAI or carry OpenAI keys. The client may request
generation through the `generateTakes` HTTPS function using the user's Firebase
ID token in `X-Firebase-Auth`.

## Runtime Pipeline

1. `useFirebaseTakes` asks `requestGeneratedTakes(category)` for more content
   when the normal visible feed is thin.
2. `generateTakes` verifies Firebase auth.
3. The function applies a per-user daily generation cap. Anonymous auth means
   this is roughly per-install protection; it is intended for cost control and
   accidental/client-loop protection, not complete abuse prevention.
4. `all` category requests resolve to the valid category with the least approved
   inventory.
5. Generation seeds come from recent, approved, human-authored takes in the
   target category when enough qualified seeds exist.
6. The model returns structured candidates with category fit, quality score,
   self-rejection reason, `voiceRegister`, and `namedEntityRisk`.
7. Candidates pass local gates:
   - category fit is `yes`
   - quality score is at least 4
   - no self-rejection reason
   - no semicolon
   - no banned frame scaffold (`we need to`, the `X is great, but Y` pivot,
     `don't get me wrong`) — enforced on text server-side because the
     prompt-level ban demonstrably leaks (2026-07-08 corpus baseline)
   - `namedEntityRisk` is not `red`; `yellow` is also rejected while the
     launch posture is green-ring only (`ALLOW_YELLOW_ENTITY_RISK = false`)
   - duplicate similarity below the generation threshold
   - local policy passes
8. Candidates then pass OpenAI moderation. Moderation failures skip the
   candidate.
9. Approved candidates are written as approved AI content with
   `isAIGenerated: true`, `userId: ai-system`, `contentSource` of `ai_blank`
   or `ai_seeded_user`, plus `promptVersion` and `voiceRegister` tags for
   cohort measurement.

## Generation v2

Model: `gpt-4.1-mini`. Prompt version tag: `v2`.

Each batch of 8 is assigned voice registers (2 texter, 2 ranter, 2 deadpan,
1 oversharer, 1 numbers) with per-register texture rules, a batch length
distribution (≥2 takes under 60 chars, ≥1 over 110), a specific-anchor
requirement (2–3 takes must contain a price, brand, app, chain, show, team,
city, device, menu item, or duration), and the three-ring named-entity policy
(green encouraged / yellow constrained / red banned). Full rationale and
policy detail live in `docs/AI_CONTENT_V2_DESIGN.md`.

Generation may retry once when the first candidate batch produces skipped
candidates and fewer than the write cap are approved. Seeded retries keep using
the same seed set.

## User Submissions

`submitTake` also verifies Firebase auth and applies a per-user daily submission
cap. User submissions must pass local policy and OpenAI moderation before being
written as approved content. If OpenAI moderation is temporarily unavailable,
the take is written as pending and remains out of the public feed until review.

## Thresholds

| System | Threshold | Outcome |
| --- | ---: | --- |
| Runtime generation duplicate check | `>= 0.75` | Candidate skipped before write |
| Scheduled hygiene exact duplicate | `>= 0.95` | AI take soft-deleted/rejected |
| Scheduled hygiene gravity similarity | `0.70` to `< 0.95` | AI take deprioritized |
| Scheduled hygiene topic gravity well | topic phrase count `>= 3` | AI take deprioritized |
| Corpus audit report | audit-specific | Read-only report unless applied by tooling |

`cleanupAIDuplicates.ts` predates the scheduled hygiene policy and should be
reviewed before use. Its threshold and outcome must not contradict the table
above.

## Rate Limits

Current server-side daily caps:

- `submitTake`: 25 requests per user per UTC day
- `generateTakes`: 30 requests per user per UTC day

These caps are intentionally modest guardrails. A determined attacker can mint
new anonymous users; App Check or stronger abuse controls are a future layer.

## Duplicate Comparison

Runtime duplicate comparison uses recent approved takes in the same category,
ordered by `createdAt desc`, limited to the comparison window. This keeps the
comparison set aligned with the content most likely to be repeated by recent
generation.

This query may require a Firestore composite index on:

- collection: `takes`
- filters: `category ==`, `isApproved ==`
- ordering: `createdAt desc`

## Cleanup And Hygiene

`runCorpusHygiene` is the scheduled source of truth for automated AI corpus
hygiene. It soft-deletes objective AI failures and deprioritizes valid but
overrepresented AI content.

Manual scripts should either mirror this policy or be retired. If a script
rejects content in a range the scheduled function would only deprioritize, the
script is out of policy.
