# Working on Focus RPG

## Workflow

Commit straight to `main` and push. This is a solo project with one user and one
deployment; a review step with nobody on the other side of it is ceremony, not safety.

The safety that does matter is further down this file: the invariants, and running the
checks below before pushing anything.

## Before pushing

```bash
npm test                   # 279 unit tests, no database needed
node --env-file=.env.local scripts/schema-check.mjs   # the live schema matches the code
npm run test:integration   # 35 probes against the real database
npx tsc --noEmit
npm run build
```

All of these must pass. The integration probe makes its own throwaway user and
deletes it.

The schema check exists because the probe does not cover it: the probe exercises
V1's tables, which have existed since the first migration, so it stays green on a
database missing every V2 table. That is exactly how a deploy lands ahead of its
schema and only fails on a page nobody has opened yet. Run `npm run db:push`
before `git push`, and this says whether it took.

## What must stay true

- **The server owns progression.** XP comes only from sessions the server timed. A browser
  can never tell the server what its character is worth. An earlier device-to-server state
  push was removed for exactly this reason.
- **The ledger is truth.** `focus_session` is the record; `game_state`, `day_ledger` and
  `streak_state` are running totals of it. Where they disagree, the ledger wins —
  `npm run db:recompute` rebuilds what is derivable. Spending a freeze is a *decision*, not
  a fact, so a day the walk has already judged is never judged again.
- **The inventory is a second ledger, and the same rule.** `inventory_entry` is append-only:
  a grant is a positive row, a spend a negative one, and `inventory_balance` is only a cache
  of the fold. Grants derive from `focus_session`; spends are decisions and are *replayed* in
  sequence order, never recomputed. `db:recompute` refolds it, and refuses to when the fold
  goes negative — that is a spend-rule bug, and rewriting the cache would hide it.
- **The write order is load-bearing.** Ledger first, cache second, collection log third. The
  Neon HTTP driver has no interactive transaction, so a crash mid-write must leave a *stale*
  balance rather than a fabricated one. Stale is recoverable; fabricated is not.
- **Nothing in the game advances while the user is away.** No timers, no offline accrual, no
  regenerating resource. Farming plots move one stage per *completed session*, which is the
  only clock this app has. Anything that "matures", "refreshes" or "restocks" on its own is
  idle progression and is forbidden.
- **Yield is seeded from the session id.** Every roll — quantity, spawn rarity, quality, the
  stat band, a drop table, a conversion — comes from `game/rng.ts` seeded on the session, so
  a recompute reproduces a session exactly. A `Date.now()` or an unseeded random in a
  resolution path makes the ledger unrebuildable.
- **A gate is a tier number.** Nothing — not handedness, not an archetype, not a quality —
  may change what a requirement gate asks for, or the greyed-out shopping list starts lying
  about what is missing.
- **Nothing is hard-deleted.** Superseded state goes to `game_state_backup`; a merged
  project keeps its row pointing at where its hours went.
- **Levels ratchet.** XP can fall; the level cannot. Prestige is the single sanctioned
  reset, and even then `peak_level` remembers.
- **The chain is derived, never stored.** `chain.ts` reads the session table and works out
  what the next session pays. Storing a multiplier would let it drift from the ledger.
- **Pure rules take `now` as an argument.** `session-engine`, `streak-engine`, `game-day`,
  `levels`, `projects`, `chain` and `prestige` have no database and no clock of their own. That is
  what makes them testable; keep new rules that shape.

  Everything under `src/lib/game/` follows it too — `tiers`, `archetypes`, `species`, `biomes`,
  `variants`, `power`, `quality`, `combat`, `drops`, `yield`, `recipes`, `economy`, `skills`,
  `gate`, `items`, `rng`, `uniques`, `bosses`, `effects`, `game-stats`, `activity`. Twenty
  modules, no database and no clock between them. The services (`activity-service`,
  `inventory-service`, `game-view-service`, `game-stats-service`) are the only things that
  touch Postgres.
- **An achievement may only read a statistic something records.** V1 shipped fifteen that could
  never fire. `GameStats` was built before V2's 224 definitions for that reason, and
  `tests/game.test.ts` sweeps every predicate against a maxed game — the deliberately
  contradictory hidden ones are exempted *by name*, so an exemption is a decision.
- **A unique's effect is typed or it says it is not.** `effects.ts` has sixteen kinds the engine
  applies; anything else is `descriptive`, which means named, intended and inert. A modifier
  written as prose that looks like it fires is worse than one that admits it does not.
- **V1's achievement set is frozen at 131.** V2 is a second list and `ALL_ACHIEVEMENTS` is the
  union. Adding a game did not change what V1 means.

## Balancing the game

```bash
node --experimental-strip-types --import ./tests/register.mjs scripts/game-audit.mjs
```

Prints what a spec cannot: the real catalogue size, the conversion curve at each tier, whether
over-tier farming is still a bad idea, what the wheel is worth, and what the sinks actually
cost. It has already caught two things a document would not have — a bank-slot curve that
compounded to twelve billion coins, and an offence/defence split that had made gunfire the
weakest style in the game. Run it after touching any number under `src/lib/game/`.

## Testing achievements and rules

Write the test from SPEC-V1.md's *wording*, not from the implementation, so it is free to
disagree with the code. Fifteen bugs were found that way — several achievements that could
never have been earned at all.

## Decisions the spec left open

Recorded in README.md rather than argued from scratch each time: achievement XP balance,
which achievements carry titles or grant freezes, the slack penalty, the within-tier level
spacing, and why the Thai holiday table is transcribed rather than computed.

## Deliberately not built

Web push and a minutely scheduler. §11 makes them conditional; they were built, priced, and
taken back out. Do not reintroduce them without the author asking.
