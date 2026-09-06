# Focus RPG — Product Spec

A single-user gamified pomodoro web app. Sessions of focused work earn XP, XP earns named
levels across a 100-level ladder, and 131 achievements reward different shapes of behavior.

This spec is the output of a full design interview. Every decision below is **settled** —
if something is not in here, it was deliberately cut or is an open implementation detail,
not an unmade product decision.

**Status:** design complete, nothing built. Next step is Phase 1.

---

## 1. Scope and intent

- **Audience:** one user (the author). No multi-tenancy concerns, no onboarding funnel, no
  landing page, no public sign-up flow.
- **Cloud sync is required** — the character must survive a browser wipe and follow the user
  between desktop and phone. This is the only reason a backend exists.
- **Not a combat game.** Earlier design rounds explored dungeon runs, enemies, loot, gear and
  an idle town. All of that was cut. What remains is XP, named levels, achievements, streaks
  and project tracking.

### Explicitly cut (do not build)

Combat / enemies / HP / damage · dungeon runs, depth, descend-or-extract · loot, gear, rarity,
shards, rerolls · classes · blacksmith, gold, crafting, skill trees · idle town, offline
resource generation · multiplayer, friends, leaderboards, social · sound design beyond a single
session-end chime · themes · pets/mounts · push notifications (deferred to Phase 4 at the
earliest).

---

## 2. Platform and stack

| Concern | Decision |
|---|---|
| Framework | Next.js (App Router) |
| Hosting | Vercel |
| Database | **Neon Postgres** (free tier) |
| ORM | Drizzle |
| Styling | Tailwind |
| Auth | **GitHub OAuth via Auth.js** |
| Icons | game-icons.net + Lucide |

### Why Neon and not Supabase

Supabase tightened its free tier in Feb 2026: projects **pause entirely after 7 days of
inactivity** and require a manual unpause from the dashboard. Neon instead scales compute to
zero after ~5 minutes idle and wakes in ~1s, so the project stays reachable with no
babysitting. Turso has more free storage but is libSQL/SQLite, not Postgres.

GitHub OAuth was chosen over magic-link email specifically to avoid wiring up an email
sending service, and because it is one tap on mobile.

### Sync model

- **Local-first.** All game state writes to `localStorage` immediately so the timer never
  blocks on the network.
- State is pushed to Neon with a **version number and a device id**.
- On conflict, **newest wins**, and the losing version is retained as a backup row. Nothing is
  ever hard-deleted.
- **Sessions are server-validated against wall-clock time.** A device with a wrong clock must
  not be able to fabricate XP. Session start time is recorded server-side; elapsed time is
  computed from the server clock, not the client's.

---

## 3. The timer

- Session lengths: **15 / 25 / 50 minutes**, chosen per session.
- XP is **1 per focused minute**. A 50-minute session pays a **+20% bonus** (60 XP), 25 and 15
  pay flat.
- **XP banks immediately** on completion. There is no run, no unbanked pool, no extract step.
- Timer is computed from **wall-clock start time**, not a client-side countdown, so closing the
  tab or sleeping the machine does not lose time.
- **Session-end notification:** OS/web notification + a chime + a live countdown in the browser
  tab title. Requires the one-time notification permission prompt.

### Pause

- **2 pauses per session, 5 minutes total.** Exceeding either count or the total = the session
  is **abandoned**.
- Paused time earns **no XP** — a paused session takes longer in wall-clock but pays the same.
- While paused, the heartbeat requirement (below) is suspended.

### Heartbeat / presence (desktop only)

- The open page pings the server every **15 seconds** — a liveness signal only, no activity
  tracking.
- **Switching to other tabs does not matter.** Research freely; only the page's existence is
  checked.
- If pings stop for more than **2 minutes** during a session, the session is **abandoned**
  (tab closed, machine slept, browser crashed).
- Reopening within 2 minutes resumes cleanly.

### Phone sessions

- Sessions **can** be started on phone.
- **Heartbeat is disabled on mobile** — mobile browsers freeze background tabs and would
  register a false abandon.
- On mobile a session ends only by completing, pressing give up, or blowing the pause budget.
- **The UI must display which ruleset is active** so the difference never feels arbitrary.

### Abandoning

Triggered by: pressing give up · exceeding the pause budget · desktop heartbeat gap > 2 min ·
starting a new session while one is live.

Consequences:
- **−30 XP**, applied immediately.
- Permanently logged. Profile shows a **completion ratio**.
- Breaks the "clean month" and no-pause achievements.
- **Streak breaks only on the second abandon in a single day.** One slip does not cost the
  streak.

---

## 4. Progression

### 4.1 Levels — 100 levels, 20 named tiers of five ranks (I–V)

The level **is** the title. Rank renders as e.g. `Adept III`.

| Levels | Title | Enter at | Tier done at |
|---|---|---|---|
| 1–5 | Drifter I–V | 0 h | 3 h |
| 6–10 | Novice I–V | 5 h | 17 h |
| 11–15 | Apprentice I–V | 21 h | 45 h |
| 16–20 | Adept I–V | 53 h | 93 h |
| 21–25 | Journeyman I–V | 105 h | 163 h |
| 26–30 | Artisan I–V | 181 h | 262 h |
| 31–35 | Specialist I–V | 285 h | 392 h |
| 36–40 | Veteran I–V | 422 h | 557 h |
| 41–45 | Master I–V | 594 h | 761 h |
| 46–50 | Sage I–V | 807 h | 1008 h |
| 51–55 | Ascendant I–V | 1008 h | 1250 h |
| 56–60 | Luminary I–V | 1250 h | 1540 h |
| 61–65 | Paragon I–V | 1540 h | 1900 h |
| 66–70 | Archon I–V | 1900 h | 2350 h |
| 71–75 | Warden I–V | 2350 h | 2900 h |
| 76–80 | Oracle I–V | 2900 h | 3600 h |
| 81–85 | Sovereign I–V | 3600 h | 4500 h |
| 86–90 | Demiurge I–V | 4500 h | 5700 h |
| 91–95 | Eternal I–V | 5700 h | 7500 h |
| 96–100 | Mythic I–V | 7500 h | **10,000 h** |

Design intent: Drifter V lands in the first afternoon, Apprentice within two weeks, Veteran is
roughly a year of real work, and **Mythic V sits on exactly 10,000 focused hours** — the cap is
the number, not an arbitrary ceiling.

**Levels ratchet.** XP can fall (the −30 abandon penalty, freeze purchases) but the level and
title **never** decrease. A penalty only delays the next rank.

**Presentation:** every rank-up is a full-screen moment. Every *tier* change gets a larger one,
since that is when the user's name actually changes.

### 4.2 Prestige

Unlocks at **level 50 (Sage V, ~1008 h)** — deliberately not at level 100, because a
10,000-hour gate would never be seen.

At level 50 the user chooses:

- **Prestige** — reset to Drifter I. Keep every achievement, every lifetime hour, and the full
  history. Gain a **★** beside the title, **+5% XP permanently**, and a prestige-tinted UI
  frame. Title renders as `★3 Adept II`.
- **Press on** — stay and climb levels 51–100 (Ascendant → Mythic), the titles prestige players
  never see.

Prestige is **repeatable**: each cycle requires reaching level 50 again. Stars stack to **★10**,
XP bonus caps at **+50%**. Reaching ★10 unlocks the exclusive title **Eternal Recurrence**.

This is the one genuine either/or decision left in the design: breadth and stars, or depth and
the rare names.

---

## 5. Achievements — 131 across 13 families

Each grants XP. **Roughly one third unlock a wearable title** that can be displayed instead of
the level title. Some grant streak freezes.

**Volume (14)** — First Session · 10 · 25 · 50 · 100 · 250 · 500 · 1000 · 2500 sessions ·
10 h · 50 h · 100 h · 500 h · 1000 h focused

**Consistency (14)** — streaks at 3 · 7 · 14 · 30 · 60 · 100 · 200 · 365 · 500 days ·
zero-abandon calendar month · four straight weeks at 10+ sessions · 12 straight weeks with a
session · a full year with no week missed · 30 days each containing a 50-min session

**Feats (15)** — three · five · eight · twelve sessions in a day · 6 h · 10 h focused in a day ·
four consecutive hours each containing a session · an all-50 day · an all-15 day · 20 in a week ·
100 in a month · 8 h across one weekend · three 50s back to back · a session every hour 9am–5pm ·
300 sessions in a month

**Time of day (10)** — before 6am · before 5am · after 11pm · after 2am · a session in every
clock hour (lifetime) · 25 pre-8am · 25 post-10pm · within 10 min of usual wake time · finish
exactly on the hour · a session crossing midnight

**Discipline (12)** — 20 · 50 · 200 zero-pause sessions · recover after a same-day abandon ·
do that three times · 10 · 100 · 500 consecutive honest self-reports · a no-pause 50 · a
pause-free week · a 100% completion month · 50 sessions with the pause budget untouched

**Recovery (7)** — return after 3 · 7 · 30 · 90 days away · rebuild a 7-day streak · rebuild a
30-day streak · beat your own longest streak

**Session mastery (9)** — 50 · 200 · 500 fifty-minute sessions · 100 · 500 twenty-five-minute ·
100 fifteen-minute · all three lengths in one day · 1000 sessions with a clean final 100 · ten
straight days finishing every planned minute

**Journal (8)** — a self-report over 100 characters · 50 of them · log the same project 10 · 50 ·
200 times · reports on 30 consecutive days · first "slacked" admission · 25 honest slack
admissions

**Calendar (9)** — New Year's Day · birthday · a public holiday · every day of one calendar
month · a session in all 12 months · all four seasons · leap day · a Sunday morning · 12
straight Mondays

**Long haul (8)** — active 3 months · 6 months · 1 year · 2 years · 3 years · 100 h in one
month · 200 h in a quarter · 1000 h lifetime with no abandon in the last 200 sessions

**Prestige (10)** — reach level 50 · prestige once · ★2 · ★3 · ★5 · ★10 · prestige with zero
abandons in the cycle · reach level 50 twice in under a year each · decline prestige and reach
level 75 · reach Mythic V

**Meta (7)** — earn 10 · 25 · 50 · 75 · 100 achievements · first hidden unlock · complete an
entire family

**Hidden (8)** — displayed as a silhouette with only a family hint until earned. Exactly-midnight
finish · seven days started to the same minute · 404 total sessions · palindromic session count ·
plus four left for the author to design later.

---

## 6. Session self-report

**Mandatory**, ~10 seconds, shown immediately after every completed session:

1. **Project tag** — pick an existing project or create one. Required.
2. **Note** — free text. Optional.
3. **Honest / slacked** toggle. A "slacked" admission reduces that session's XP but carries no
   further penalty.

This is the only thing holding the numbers up (see §10), so it must not be skippable.

### Projects

Every session attaches to exactly one project. Projects accumulate their own hour totals and
their own level on a **separate, shorter ladder**, so a project title is never confused with the
character's:

| Project title | Hours |
|---|---|
| Seedling | 1 h |
| Sapling | 10 h |
| Grove | 50 h |
| Landmark | 200 h |
| Monument | 500 h |

Needs rename and merge handling. "480 hours on the thesis" is the single most motivating number
this app can display — treat per-project totals as a first-class view.

---

## 7. Streaks and freezes

- **Any completed session keeps the streak.** No daily minutes goal, no tiers.
- **Day rolls over at 4am**, so a 1am session still counts toward the day the user thinks
  they are in.
- Streak breaks only if: the user is away, unannounced, with an empty freeze bank, on a
  non-rest day — **or** abandons twice in one day.

### Freezes

Earned from **four sources**:

1. **Streak length** — 1 freeze per 5 consecutive days.
2. **Achievements** — certain unlocks grant them.
3. **Freeze Meter (passive)** — **20% of all XP earned** also drips into a meter. At **300 FP**
   it converts to a freeze automatically. (~1 freeze per 12 days at 2 h/day.)
4. **Direct purchase** — **400 XP** from the streak panel. Because levels ratchet, spending XP
   can never cost a rank.

**Cap: 14 held** (two weeks' worth). At cap, the Freeze Meter keeps filling and retains its FP
rather than wasting it; streak- and achievement-granted freezes queue and land the moment the
bank drops below 14. Since no XP is earned while away, a 14 cap also means at most 14
consecutive frozen days — one number does both jobs.

**Application is automatic.** Miss a day with a freeze banked and it spends itself overnight —
no prompt, no decision. The heatmap renders that day as a **frosted square**, visibly distinct
from both a filled day and a gap. On next open, one line: *"Freeze used — streak intact, 3
left."*

### Rest days

Mark up to **2 weekdays per week** as scheduled rest days. They never break a streak and never
consume a freeze. Set once in settings.

### Vacation mode

Declare up to **21 days** off in advance, **once per quarter**. Streak frozen entirely, no
freezes spent, dashboard renders the period greyed rather than empty.

---

## 8. Look and feel

**Icon-driven, no custom art.** There is no artist on this project and the design must read as
deliberate rather than half-finished.

- **game-icons.net** for achievements, tiers and projects; Lucide for UI chrome.
- **Monospace numerals** everywhere numbers matter (timer, XP, hours).
- **Tier and rarity colors** carry hierarchy instead of illustration.
- **Juice over assets:** animated XP gain, number pop, full-screen level-up and tier-up moments,
  frosted-square transitions. Game feel comes from motion, not sprites.

---

## 9. Views

- **Timer** — length selector, active session, pause control, ruleset indicator.
- **Character** — level, tier title, rank, prestige stars, XP bar, wearable title selector.
- **Achievements** — 13 families, locked/unlocked, hidden ones as silhouettes.
- **Projects** — per-project hours, project level, history.
- **Session log** — reverse-chronological, with tags, notes and honest/slacked flags.
- **Year heatmap** — GitHub-style grid; filled, frosted (freeze), rest-day and gap states.
- **Dashboard (full)** — daily and weekly bars · hours per project over time · time-of-day
  analysis · completion-ratio trend · projection for next rank.
- **Streak panel** — current streak, freezes held, Freeze Meter progress, purchase button, rest
  day settings, vacation mode.

---

## 10. Known risks

Recorded deliberately, accepted by the author, not open questions.

1. **No decisions left in the loop.** Every mechanic rewards; none asks the user to choose.
   Combat, dungeon depth and descend-or-extract were the mechanics that created a genuine
   afternoon decision, and all were cut. Prestige at level 50 is the only remaining either/or,
   and it is ~1000 hours away. Long-term engagement rests entirely on the level curve, the
   achievement list and the heatmap.
2. **The loop is cheatable by anyone who wants to cheat it.** A pause button plus phone sessions
   without a heartbeat plus honor-system reporting means a timer can run while the user does
   something else. The mandatory self-report is the only thing keeping the numbers meaningful.
   Acceptable for a personal tool; it would not survive a public leaderboard.

---

## 11. Build phases

Each phase is independently usable. Stopping after any one leaves a real thing.

### Phase 1 — Core (start here)
- Next.js scaffold, deployed to Vercel.
- Neon database + Drizzle schema.
- GitHub OAuth login via Auth.js.
- Timer: 15/25/50, wall-clock based, pause budget, give-up.
- Desktop heartbeat + 2-min grace; mobile detection disables it.
- XP, the 100-level ladder with named tiers/ranks, ratcheting levels.
- Abandon handling: −30 XP, logged, completion ratio.
- Mandatory self-report with project tag + note + honest/slacked.
- Session log.
- OS notification + chime + tab-title countdown.
- Local-first writes with versioned cloud sync.

### Phase 2 — Streaks and achievements
- Streak with 4am rollover.
- Freezes: all four sources, 14 cap, auto-apply, Freeze Meter, purchase.
- Rest days, vacation mode.
- All 131 achievements + wearable titles.
- Year heatmap with filled / frosted / rest / gap states.

### Phase 3 — Projects and dashboard
- Project management: create, rename, merge.
- Project ladder (Seedling → Monument).
- Full dashboard: bars, per-project time series, time-of-day analysis, completion trend,
  next-rank projection.

### Phase 4 — Depth and polish
- Prestige (level 50 gate, stars, XP bonus, Eternal Recurrence).
- Hidden achievements.
- Level-up and tier-up animation polish.
- PWA + push notifications, **only if** missed session ends turn out to be a real problem in
  daily use.
