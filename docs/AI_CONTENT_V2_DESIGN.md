# AI Content Generation v2 — Design

Status: approved working direction (July 2026). No implementation yet.
Companion docs: `docs/AI_CONTENT_SPEC.md` (current pipeline truth),
`docs/FEED_SPEC.md` (feed contract). This document describes the target
state; the spec docs are updated only as PRs land.

## Goal

Make AI-generated takes sound like actual people with current obsessions,
not a columnist trapped inside thirteen dropdown categories. Three levers:
voice registers, specific anchors, and topical lanes. All existing safety
machinery — local policy, OpenAI moderation, duplicate similarity gate,
write cap, rate limits — is preserved byte-identical.

Diagnosis this responds to: the v1 prompt's quality gates select for a
single polished "brunch essayist" register, suppress specificity, and the
generation model's knowledge cutoff makes current references impossible.
Prompt gravity is the primary cause; model age is secondary. Both are
addressed here.

## Voice registers

Five registers. Assigned server-side per batch of 8 (seeded rotation by
category + date), recorded in the model's JSON output as `voiceRegister`.

| Register | Sound | Slots/batch |
| --- | --- | --- |
| `texter` | short, casual, lowercase allowed | 2 |
| `ranter` | momentum, one emphatic beat, no cruelty | 2 |
| `deadpan` | dry, precise, understated | 2 |
| `oversharer` | anecdote-anchored, stance required | 1 |
| `numbers` | anchored on a price/count/duration | 1 |

The v1 essayist voice is retired as the default; deadpan is its nearest
heir. "Reluctant confessor" ("I'll die on this hill…") is a texture, not a
register: allowed at most once per batch, any register.

## Texture rules

- Lowercase openings: `texter` only, max 2 per batch.
- Fragments: `texter` and `deadpan` only; a fragment still carries a stance.
- Questions: whole-take questions banned. One trailing rhetorical tag per
  batch, `ranter` only.
- Anecdotes: `oversharer` only; format is observation + verdict, never
  story-only. First person required there, optional elsewhere.
- ALL CAPS: one word max, `ranter` only. Emoji: max one, `texter` only.
- Deliberate typos: never. Fake typos read as fake and pollute duplicate
  fingerprinting.
- Length distribution enforced per batch: ≥2 takes under 60 chars, ≥1 over
  110 chars. Range stays 10–150.
- Unchanged from v1: no semicolons, no hedged stances, no links/hashtags,
  no "hot take:" prefixes.

## Specific anchors

Each batch must include 2–3 takes with a *specific anchor*: a price, brand,
app, chain, show, team, city, device, menu item, duration, or workplace
object. Proper nouns are one kind of anchor, not the requirement — "$14
dessert" is as real as a named chain.

### Named-entity policy (three rings)

- **Green (encouraged):** brands, products, apps, chains, foods,
  shows/movies/games/music, sports teams/leagues, historical figures,
  places, prices, durations.
- **Yellow (constrained):** living celebrities and athletes — public work
  and persona only. Never appearance/body, health, relationships,
  allegations, or private conduct. Companies: pricing/quality/design
  opinions yes; crime or fraud assertions no. Frame test: opinion about
  public output, never fact claim about conduct.
- **Red (banned):** named politicians and political operatives, anyone
  primarily famous via an ongoing legal case or scandal, private
  individuals, minors, medical claims about any person.

Enforcement in depth: rules in the prompt; a new self-eval schema field
`namedEntityRisk: none | green | yellow | red` with red rejected
server-side before moderation; OpenAI moderation as backstop.

**Politics stays fully evergreen.** No named figures, no topical lanes, no
current-events angle. The app feels current through food, tech,
entertainment, sports, travel, work, and relationships.

## Topical lanes

Firestore doc `contentConfig/topicalLanes`, editable in the console without
a deploy:

```
{
  updatedAt: Timestamp,
  lanes: [{
    id: string,
    topic: string,
    category: Category | 'any',   // never 'politics'
    angleHint?: string,
    expiresAt: Timestamp,
    allowNamedPeople: boolean      // false locks lane to green ring
  }]
}
```

`generateTakes` reads the doc (in-memory cache ~10 min per instance),
injects unexpired lanes matching the requested category as "current
obsessions people are actually arguing about," and logs which lanes were
offered. Takes generated against a lane are tagged `topicalLaneId`.

Degradation: expired lanes are ignored; if the doc is >30 days stale the
function logs a warning and runs fully evergreen. Currency degrades
gracefully; generation never breaks.

Phase 1 feeds lanes into **existing categories only**. The 🌡️ This Week
category is a later, additive product surface (see rollout). Aging for
This Week content reuses the existing deprioritization system:
`deprioritizedReason: 'stale_lane'` (already in the type system) with
`deprioritizedUntil ≈ lane expiresAt`.

Later, optional: a weekly scheduled job using a search-enabled model writes
*proposed* lanes to `contentConfig/proposedLanes`; a human approves by
copying into the live doc.

## Tagging (mandatory from day one)

Every v2 take is written with:

- `promptVersion: 'v2'`
- `voiceRegister: <register>`
- `topicalLaneId: <id>` when lane-derived

No tags → no learning. This is a hard requirement of PR 2, not an
enhancement.

## Measurement

Extend the read-only `auditCorpus` script with a scoreboard comparing
cohorts (`user`, `ai_blank`, `ai_seeded_user`, `promptVersion: v2`, and
per-register within v2) on:

- **Skip rate:** skips / (skips + totalVotes).
- **Split quality:** distance from 50/50 weighted by volume — same formula
  as `getSeedScore` so "good take" means one thing everywhere.
- **Favorites per 100 votes.**
- **Hygiene mortality:** how fast a cohort is gravity-well-deprioritized or
  duplicate-rejected.

Known gap: shares are recorded globally, not per-take. Acceptable at
launch; add takeId to share analytics later.

Protocol: run the scoreboard **before** v2 ships (v1 baseline), then at 2
and 4 weeks. Success criteria: v2 skip rate within 10% of human-submitted
content; split quality ≥ `ai_seeded_user`; no increase in moderation
rejections; register breakdown identifies voices to double down on.

## Rollout

1. **PR 1 — scoreboard first.** `auditCorpus` extensions + v1 baseline run.
   Read-only, zero production risk, and the baseline is unrecoverable if v2
   ships before it.
2. **PR 2 — generator v2.** Registers, texture rules, anchors,
   `namedEntityRisk` schema field, tagging, model upgrade (pick the current
   OpenAI small model at implementation time). Server-only; no client or
   category changes. Update `docs/AI_CONTENT_SPEC.md` in the same PR.
3. **PR 3 — topical lanes** feeding existing categories. Server-only plus
   the config doc.
4. **PR 4 (optional) — 🌡️ This Week** product surface: client dropdown,
   `VALID_CATEGORY_LIST`, dual-tagging (This Week takes keep a real
   category for leaderboards), stale_lane aging.

Each functions PR: `npm --prefix functions run typecheck` before deploy.

## Risks and guardrails

- New registers will grow new clichés. Cap "I'll die on this hill" at one
  per batch from day one; refresh corpus-hygiene topic lists ~1 month after
  launch.
- Casual registers produce shorter, noisier duplicate fingerprints. Watch
  duplicate-rejection logs in week one for false positives before touching
  the 0.75 threshold.
- Yellow-ring content is the moderation-sensitive surface. If moderation
  rejections rise, tighten to green-only via prompt, no deploy of new
  logic needed.
- Model + prompt change together in PR 2. Deliberate: we measure
  v2-as-a-package against the baseline, not a controlled experiment.
