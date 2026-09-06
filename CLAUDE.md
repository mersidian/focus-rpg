# Working on Focus RPG

## Workflow

Commit straight to `main` and push. This is a solo project with one user and one
deployment; a review step with nobody on the other side of it is ceremony, not safety.

The safety that does matter is further down this file: the invariants, and running the
checks below before pushing anything.

## Before pushing

```bash
npm test                   # 150 unit tests, no database needed
npm run test:integration   # 35 probes against the real database
npx tsc --noEmit
npm run build
```

All four must pass. The integration probe makes its own throwaway user and deletes it.

## What must stay true

- **The server owns progression.** XP comes only from sessions the server timed. A browser
  can never tell the server what its character is worth. An earlier device-to-server state
  push was removed for exactly this reason.
- **The ledger is truth.** `focus_session` is the record; `game_state`, `day_ledger` and
  `streak_state` are running totals of it. Where they disagree, the ledger wins —
  `npm run db:recompute` rebuilds what is derivable. Spending a freeze is a *decision*, not
  a fact, so a day the walk has already judged is never judged again.
- **Nothing is hard-deleted.** Superseded state goes to `game_state_backup`; a merged
  project keeps its row pointing at where its hours went.
- **Levels ratchet.** XP can fall; the level cannot. Prestige is the single sanctioned
  reset, and even then `peak_level` remembers.
- **Pure rules take `now` as an argument.** `session-engine`, `streak-engine`, `game-day`,
  `levels`, `projects` and `prestige` have no database and no clock of their own. That is
  what makes them testable; keep new rules that shape.

## Testing achievements and rules

Write the test from SPEC.md's *wording*, not from the implementation, so it is free to
disagree with the code. Fifteen bugs were found that way — several achievements that could
never have been earned at all.

## Decisions the spec left open

Recorded in README.md rather than argued from scratch each time: achievement XP balance,
which achievements carry titles or grant freezes, the slack penalty, the within-tier level
spacing, and why the Thai holiday table is transcribed rather than computed.

## Deliberately not built

Web push and a minutely scheduler. §11 makes them conditional; they were built, priced, and
taken back out. Do not reintroduce them without the author asking.
