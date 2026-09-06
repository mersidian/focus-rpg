# Focus RPG

[SPEC.md](SPEC.md), built in full. Sessions of focused work bank
XP against the 100-level named ladder, and keep a streak that freezes rather than breaks.
At level 50 you choose between beginning again with a star and pressing on to names no
prestige player ever sees.

## What runs

| Spec item | Where |
|---|---|
| Next.js on Vercel | App Router, `src/app` |
| Neon + Drizzle | `src/lib/db/schema.ts`, `drizzle/0000_*.sql` |
| GitHub OAuth via Auth.js | `src/lib/auth.ts` |
| Timer 15/25/50, wall-clock | `src/lib/session-engine.ts`, `src/components/TimerScreen.tsx` |
| Pause budget, give up | same |
| Desktop heartbeat + 2-min grace; mobile off | `src/app/api/heartbeat/route.ts`, `src/lib/client/device.ts` |
| XP, 100 levels, 20 tiers, ratcheting | `src/lib/levels.ts`, `src/lib/game-state.ts` |
| Abandon: −30 XP, logged, completion ratio | `src/lib/session-service.ts` |
| Mandatory self-report | `src/components/ReportCard.tsx` |
| Session log | `src/app/log/page.tsx` |
| Notification, chime, tab-title countdown | `src/lib/client/notify.ts`, `chime.ts`, `TimerScreen.tsx` |
| Local-first writes, versioned cloud sync | `src/components/GameProvider.tsx`, `src/lib/game-state.ts` |
| **Phase 2** — streak with 4am rollover | `src/lib/game-day.ts` |
| Freezes: four sources, 14 cap, auto-apply, meter, purchase | `src/lib/streak-engine.ts` |
| Rest days, vacation mode | `src/lib/streak-service.ts`, `src/components/StreakControls.tsx` |
| Year heatmap: filled / frosted / rest / gap | `src/components/Heatmap.tsx` |
| 131 achievements in 13 families, wearable titles | `src/lib/achievements/` |
| **Phase 4** — prestige: gate, stars, XP bonus, Eternal Recurrence | `src/lib/prestige.ts`, `src/lib/prestige-service.ts` |
| Prestige-tinted frame, star titles | `src/components/PrestigeFrame.tsx` |
| Level-up and tier-up moments | `src/components/LevelUpOverlay.tsx` |
| **Phase 3** — projects: create, rename, merge | `src/lib/project-service.ts`, `src/components/ProjectManager.tsx` |
| Project ladder, Seedling to Monument | `src/lib/projects.ts` |
| Dashboard: bars, per-project series, time of day, completion trend | `src/app/dashboard/` |
| Projection for the next rank | `src/lib/projection.ts` |

Sessions are validated against the **server** clock. A device with a wrong clock cannot
fabricate XP: the browser only ever asks the server what time it is.

## Setup

1. **Neon.** Create a project at [neon.tech](https://neon.tech) and copy the *pooled*
   connection string.
2. **GitHub OAuth.** Settings → Developer settings → OAuth Apps → New. Callback URL
   `http://localhost:3000/api/auth/callback/github`. Add a second app, or a second
   callback, for your deployed URL.
3. **Environment.** `cp .env.example .env.local` and fill it in. `.env.local` already has
   an `AUTH_SECRET`; generate another with `npx auth secret`.
   Set `ALLOWED_GITHUB_LOGIN` to your GitHub username so only you can sign in.
4. **Schema.**

```bash
npm run db:push
```

5. **Run.**

```bash
npm run dev
```

Deploying to Vercel: import the repo, paste the same four variables into project
settings, and add your production callback URL to the GitHub OAuth app. Nothing else.

```bash
npm test                   # 141 unit tests, no database needed
npm run test:integration   # 35 probes against the real database
```

The integration probe creates a throwaway user, exercises the flows that unit tests
cannot reach — repeated and concurrent streak walks, double achievement evaluation,
prestige and project guards — and deletes itself afterwards.

58 tests over the level ladder, the session rules (the heartbeat-versus-completion race,
the pause budget, the two rulesets), game-day bucketing at the 4am boundary, and the
streak walk — freezes spending themselves, queueing at cap, and the meter retaining its
points rather than wasting them.

**The day is `Asia/Bangkok`, and the boundary is 4am.** Sessions bucket by the time they
*started*, so work begun at 1am belongs to the night before. The timezone is stored on
`user_settings`, never read from the browser: the same session must land on the same day
whichever device opens the app.

## Repairing the character sheet

`focus_session` is the ledger; `game_state` is a running total of it. If the two ever
disagree, the ledger wins:

```bash
npm run db:recompute            # shows the difference, changes nothing
npm run db:recompute -- --apply # rewrites, keeping the old row as a backup
```

## Achievement balance

The spec fixes what each achievement is *for* but not what it pays, which carry a title, or
which grant freezes. All three are set in `src/lib/achievements/definitions.ts`:

- **XP follows a five-step rarity ladder**, deliberately small. The level ladder is
  calibrated in focused hours — Mythic V *is* ten thousand of them — so achievements have
  to stay a garnish rather than a second income. All 131 together are worth about 27,000
  XP: 4.5% of the ladder, or 446 hours' worth. An early draft paid five times that and
  carried a test account to level 26 on thirty hours of work.
- **44 carry a wearable title** — roughly the third the spec asks for. They go to the ones
  that describe a person rather than a number: you can wear "Night Shift", not "50 sessions".
- **13 grant freezes**, 31 in total, all in Consistency and Recovery — the two families
  about surviving time away, so the reward matches what the achievement is about.
- **Nine wait on Phase 4.** "Decline prestige and reach level 75" cannot be earned by
  someone who was never offered the choice, so the engine skips them rather than firing on
  the half of the condition that is already true.

## Prestige

Level and XP are the only things a reset takes. Achievements, lifetime hours, the session
log, the streak and the freeze bank all survive, and `game_state.peak_level` records the
highest level ever reached so "reach level 50" stays earned through the reset that
immediately follows it.

The `+5%` per star applies to **session XP only**, not to achievement awards. Achievement
XP is deliberately balanced as a fixed share of the ladder; multiplying it would let that
share drift with stars.

**Push notifications are deliberately not built.** §11 gates them on "only if missed
session ends turn out to be a real problem in daily use", and the app has not been through
daily use yet. The OS notification, chime and tab-title countdown from Phase 1 are the
current answer; if sessions start slipping past unnoticed, that is the signal to build the
PWA.

## Small screens

Every page is checked down to 320px with no sideways scroll on the body; wide content —
the year heatmap — scrolls inside its own container instead. The navigation wraps to a
second line on a phone rather than running off the edge, because hiding half the app
behind a sideways scroll nobody would think to try is worse than a second row. Tap
targets are at least 36px tall.

The database is reached through a fetch that retries transport failures. Neon sleeps when
idle and wakes on the next request, so the first query after a quiet spell — or one sent
over a patchy phone connection — can fail before the database ever sees it. A query the
database actually answered is never retried.

## The dashboard's colours

Single-series charts — daily bars, weekly bars, the hour histogram, the completion trend —
are drawn in the tier the character has earned, which is the app's one accent (§8) and
needs no legend because the heading names the series.

Only the per-project series carries *identity*, so it uses a fixed categorical order of
six that was validated against this app's surface for lightness band, chroma, contrast,
adjacent-pair separation and colour-vision deficiency. Colour follows the project, never
its rank, so a quiet month never repaints the others; a seventh project folds into "Other"
rather than inventing a hue.

Pace for the next-rank projection counts the days you did not work. Averaging only active
days would flatter the number and make the date wrong.

## Decisions the spec left open

Four things were not settled in SPEC.md and had to be chosen to build. Each is one
constant or one commented block, easy to change.

- **Where ranks II–IV sit inside a tier.** The spec's table pins rank I and rank V of
  every tier; the three ranks between them divide the remainder evenly. Every hour figure
  in the table is reproduced exactly — Sage V on 1008 h, Mythic V on 10,000 h.
- **The upper half's "enter at" column.** From Ascendant onward the table repeats the
  previous tier's rank V figure, which cannot be a second threshold: two levels cannot
  cost the same. Those ten tiers place rank I a fifth of the way in, matching the shape of
  the lower ten. See the comment at the top of `src/lib/levels.ts`.
- **What a "slacked" admission costs.** §6 says it reduces the session's XP without saying
  by how much. Currently half — `SLACKED_XP_MULTIPLIER` in `src/lib/constants.ts`.
- **Who may sign in.** The spec says single-user, but the app sits on a public URL, so
  `ALLOWED_GITHUB_LOGIN` locks sign-in to one GitHub account. Unset, anyone may sign in.

## The look

§8 asked for hierarchy carried by tier colour rather than illustration, so the interface
accent *is* the tier: each of the twenty tiers owns a hue, and the progress rails, the
countdown and the rank title are all drawn in the colour the character has earned. A
Drifter's app is nearly colourless; a Mythic's burns violet. Nothing else on the page is
allowed to be saturated.

Numerals are monospaced and tabular throughout. Fraunces sets the earned title and
nothing else, so the name reads as a name.
