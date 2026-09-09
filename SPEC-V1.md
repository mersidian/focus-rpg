# Focus RPG — V1 Spec (shipped)

A single-user gamified pomodoro web app. Sessions of focused work earn XP, XP earns named
levels across a 100-level ladder, and 131 achievements reward different shapes of behavior.

**Status: built in full and running.** This document is the record of what V1 is, not a
plan. Where the build had to decide something this spec left open, the decision is written
in here now rather than living only in the README.

**The successor is [SPEC-V2.md](SPEC-V2.md)** — a skill economy, crafting, equipment and
monster combat. V2 reverses several cuts made in §1. Nothing in V2 is built yet.

> **Section numbers are load-bearing.** Roughly 150 comments across `src/` and `tests/`
> cite this file by section — `levels.ts` cites §4.1, `game-day.ts` cites §7,
> `definitions.ts` cites §5. Do not renumber sections. Add, never resequence.

---

## 1. Scope and intent

- **Audience:** one user (the author). No multi-tenancy, no onboarding funnel, no landing
  page. Sign-in is locked to a single GitHub account via `ALLOWED_GITHUB_LOGIN`, because
  the app sits on a public URL.
- **Cloud sync is required** — the character must survive a browser wipe and follow the
  user between desktop and phone. This is the only reason a backend exists.
- **Not a combat game.** V1 deliberately shipped XP, named levels, achievements, streaks
  and project tracking, and nothing else.

### What V1 cut

Combat / enemies / HP / damage · dungeon runs, depth, descend-or-extract · loot, gear,
rarity, shards, rerolls · classes · blacksmith, gold, crafting, skill trees · idle town,
offline resource generation · multiplayer, friends, leaderboards, social · sound design
beyond a session-end chime · themes · pets/mounts · push notifications.

**Most of that list is being reintroduced by V2**, at the author's explicit request, which
is the condition CLAUDE.md sets on reversing a cut. See [SPEC-V2.md](SPEC-V2.md) §1 for
what stays cut permanently — chiefly **idle and offline progression**, which no version may
ever have, and **real-time combat**.

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

Supabase tightened its free tier in Feb 2026: projects pause entirely after 7 days of
inactivity and need a manual unpause. Neon scales compute to zero after ~5 minutes idle and
wakes in ~1s, so the project stays reachable with no babysitting. Turso has more free
storage but is libSQL, not Postgres.

GitHub OAuth was chosen over magic-link email to avoid running an email service, and
because it is one tap on mobile.

### Sync model

- **Local-first.** Game state writes to `localStorage` immediately so the timer never
  blocks on the network.
- State pushes to Neon with a **version number and a device id**. On conflict **newest
  wins**, and the losing version is retained in `game_state_backup`. Nothing is
  hard-deleted.
- **Sessions are validated against the server clock.** The browser only ever asks the
  server what time it is; a device with a wrong clock cannot fabricate XP.

---

## 3. The timer

- Session lengths: **15 / 25 / 50 minutes**, chosen per session.
- XP is **1 per focused minute**; a 50-minute session pays a **+20% bonus** (60 XP).
- **XP banks immediately** on completion. No run, no unbanked pool, no extract step.
- Timer is computed from **wall-clock start time**, so closing the tab or sleeping the
  machine loses no time.
- **Session end:** OS notification + chime + live countdown in the tab title.

### Pause

- **2 pauses per session, 5 minutes total.** Exceeding either abandons the session.
- Paused time earns no XP.
- While paused, the heartbeat requirement is suspended.

### Heartbeat / presence (desktop only)

- The open page pings every **15 seconds** — liveness only, no activity tracking.
- **Other tabs do not matter.** Only the page's existence is checked.
- A gap over **2 minutes** during a session abandons it. Reopening inside 2 minutes
  resumes cleanly.

### Phone sessions

Allowed, with **the heartbeat disabled** — mobile browsers freeze background tabs and would
register false abandons. On mobile a session ends only by completing, giving up, or blowing
the pause budget. The UI shows which ruleset is active.

### Abandoning

Triggered by: giving up · exceeding the pause budget · a desktop heartbeat gap over 2
minutes · starting a new session while one is live.

- **−30 XP**, applied immediately.
- Permanently logged; the profile shows a **completion ratio**.
- Breaks the "clean month" and no-pause achievements.
- **The streak breaks only on the second abandon in one day.**

---

## 4. Progression

### 4.1 Levels — 100 levels, 20 named tiers of five ranks

The level **is** the title, rendered as e.g. `Adept III`.

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

Drifter V lands in the first afternoon; Mythic V sits on exactly 10,000 focused hours.

**Levels ratchet.** XP can fall — the −30 abandon penalty, freeze purchases — but level and
title never decrease. A penalty only delays the next rank.

**Resolved during the build** (was left open):
- The table pins rank I and rank V of each tier; **ranks II–IV divide the remainder
  evenly**.
- From Ascendant onward the table repeats the previous tier's rank V figure, which cannot
  be a second threshold. Those ten tiers **place rank I a fifth of the way in**, matching
  the lower ten. See the comment atop `src/lib/levels.ts`.

**Presentation:** every rank-up is a full-screen moment; every tier change gets a larger
one, because that is when the character's name changes.

### 4.2 Prestige

Unlocks at **level 50 (Sage V, ~1008 h)** — not at 100, because a 10,000-hour gate would
never be seen.

- **Prestige** — reset to Drifter I, keeping every achievement, lifetime hour and history.
  Gain a **★**, **+5% XP permanently**, and a prestige-tinted frame. Title renders as
  `★3 Adept II`.
- **Press on** — stay and climb 51–100 (Ascendant → Mythic), the titles prestige players
  never see.

Repeatable: each cycle needs level 50 again. Stars stack to **★10**, XP bonus caps at
**+50%**. ★10 unlocks the exclusive title **Eternal Recurrence**.

---

## 5. Achievements — 131 across 13 families

Each grants XP; roughly a third unlock a **wearable title**. Some grant streak freezes.

**Volume (14)** · **Consistency (14)** · **Feats (15)** · **Time of day (10)** ·
**Discipline (12)** · **Recovery (7)** · **Session mastery (9)** · **Journal (8)** ·
**Calendar (9)** · **Long haul (8)** · **Prestige (10)** · **Meta (7)** · **Hidden (8)**

The full definitions live in `src/lib/achievements/definitions.ts`, which is authoritative;
the thirteen family names above are the spec's contribution. Hidden achievements display as
a silhouette with only a family hint until earned.

Achievement tests are written from this spec's *wording* rather than from the
implementation, which is how fifteen bugs were found — several achievements that could not
have been earned at all.

---

## 6. Session self-report

**Mandatory**, ~10 seconds, immediately after every completed session:

1. **Project tag** — pick or create. Required.
2. **Note** — free text, optional.
3. **Honest / slacked** toggle.

A "slacked" admission **halves** that session's XP (`SLACKED_XP_MULTIPLIER`) — resolved
during the build; the spec had said only "reduces". No further penalty.

This is the only thing holding the numbers up (§10), so it is not skippable.

### Projects

Every session attaches to exactly one project. Projects accumulate their own hours and a
level on a shorter ladder:

| Project title | Hours |
|---|---|
| Seedling | 1 h |
| Sapling | 10 h |
| Grove | 50 h |
| Landmark | 200 h |
| Monument | 500 h |

Rename and merge are supported; a merged project keeps its row pointing at where its hours
went, because nothing is hard-deleted.

---

## 7. Streaks and freezes

- **Any completed session keeps the streak.** No daily minutes goal.
- **The day rolls over at 4am**, so a 1am session counts toward the day the user thinks
  they are in.
- The streak breaks only if the user is away, unannounced, with an empty bank, on a
  non-rest day — or abandons twice in one day.

### Freezes — four sources

1. **Streak length** — 1 per 5 consecutive days.
2. **Achievements** — certain unlocks grant them.
3. **Freeze Meter** — **20% of all XP earned** drips into a meter; **300 FP** converts to a
   freeze automatically.
4. **Purchase** — **400 XP** from the streak panel. Because levels ratchet, spending can
   never cost a rank. *(V2 moves this cost to coins.)*

**Cap: 14 held.** At cap the Meter keeps its FP rather than wasting it, and granted freezes
queue until the bank drops below 14. Since no XP is earned while away, a 14 cap also means
at most 14 consecutive frozen days.

**Application is automatic** — a missed day with a freeze banked spends it overnight, no
prompt. The heatmap renders it as a **frosted square**, distinct from both a filled day and
a gap, and one line on next open says so.

**Rest days:** up to **2 weekdays per week**, which never break a streak and never consume
a freeze. **Vacation mode:** up to **21 days**, once per quarter, declared in advance.

A day the freeze walk has already judged is never judged again — spending a freeze is a
*decision*, not a fact, and decisions are replayed rather than recomputed.

---

## 8. Look and feel

**Icon-driven, no custom art.** game-icons.net for achievements and tiers, Lucide for UI
chrome. Monospace tabular numerals wherever numbers matter.

**Hierarchy is carried by tier colour, not illustration** — resolved in the build as: each
of the twenty tiers owns a hue, and the progress rails, countdown and rank title are drawn
in the colour the character has earned. A Drifter's app is nearly colourless; a Mythic's
burns violet. Nothing else on the page may be saturated. Fraunces sets the earned title and
nothing else, so the name reads as a name.

Game feel comes from motion, not sprites: animated XP gain, number pop, full-screen
level-up and tier-up moments.

---

## 9. Views

- **Timer** — length selector, active session, pause control, ruleset indicator.
- **Character** — level, tier title, rank, prestige stars, XP rail, wearable title picker.
- **Achievements** — 13 families, locked/unlocked, hidden as silhouettes.
- **Projects** — per-project hours, project level, history.
- **Session log** — reverse-chronological, with tags, notes and honest/slacked flags.
- **Year heatmap** — filled, frosted, rest-day and gap states.
- **Dashboard** — daily and weekly bars · hours per project over time · time-of-day
  analysis · completion-ratio trend · projection for next rank.
- **Streak panel** — streak, freezes, Meter progress, purchase, rest days, vacation mode.

---

## 10. Known risks

1. **No decisions left in the loop.** Every V1 mechanic rewards; none asks the user to
   choose. Prestige at level 50 is the only either/or and it is ~1000 hours away.

   **Partly answered after shipping** by the session chain (`src/lib/chain.ts`), which is
   not in this spec: finishing a session opens a 10-minute window, and starting another
   inside it pays more. The link you have not started is always worth the most and always
   the hardest to begin — which is the decision. **V2 answers it properly**, since
   preparation before a combat session is a real choice with real inputs.

2. **The loop is cheatable by anyone who wants to cheat it.** A pause button, phone
   sessions without a heartbeat, and honor-system reporting mean a timer can run while the
   user does something else. The mandatory self-report is the only thing keeping the
   numbers meaningful. Acceptable for a personal tool; it would not survive a public
   leaderboard.

---

## 11. Build phases — all complete

- **Phase 1 — Core.** Scaffold on Vercel, Neon + Drizzle, GitHub OAuth, the timer with
  pause and heartbeat, XP and the 100-level ladder, abandon handling, the mandatory
  self-report, the session log, notifications, local-first sync.
- **Phase 2 — Streaks and achievements.** 4am rollover, all four freeze sources, rest days,
  vacation mode, 131 achievements, wearable titles, the year heatmap.
- **Phase 3 — Projects and dashboard.** Project create/rename/merge, the project ladder,
  the full dashboard, next-rank projection.
- **Phase 4 — Depth and polish.** Prestige, hidden achievements, level-up and tier-up
  animation.

**Deliberately not built, and still not:** web push and a minutely scheduler. This section
made them conditional; they were built, priced, and taken back out. See CLAUDE.md.

**Added after the phases, not in this spec:** the session chain (§10), session correction,
and the transcribed Thai public-holiday table. Each is argued in README.md.

**V1 is closed.** New work belongs in [SPEC-V2.md](SPEC-V2.md).
