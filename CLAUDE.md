# Working on Focus RPG

## Workflow

Commit straight to `main` and push. This is a solo project with one user and one
deployment; a review step with nobody on the other side of it is ceremony, not safety.

The safety that does matter is further down this file: the invariants, and running the
checks below before pushing anything.

## Before pushing

```bash
npm test                   # the unit tests, no database needed
node --env-file=.env.local scripts/schema-check.mjs   # the live schema matches the code
npm run test:integration   # the probes against the real database
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
- **A tool reaches one tier past itself, so the ladder climbs without the shop.** Asking for a
  tool of the same tier is circular at every rung: bronze ore wants a bronze pickaxe, which
  wants a bronze bar, which wants bronze ore. The shop was the only way out, which made a
  convenience into a requirement. The deadlock was found once at the bottom and patched with a
  special case — "tier 1 needs no tool: a rock and a stick" — without anyone noticing it
  repeated all the way up; `offers` had always built gathering to `bestTool + 1`, so the list
  carried one row the gate could never open. A test walks tier 1 to 24 from the starter kit
  alone. The skill requirement is untouched and is the real pacing.
- **A gate is a tier number.** Nothing — not handedness, not an archetype, not a quality —
  may change what a requirement gate asks for, or the greyed-out shopping list starts lying
  about what is missing.
- **A skill opens at a character level, and that unlock is paid only in minutes.** SPEC-V2.md
  §11's first seam — *"skills gate on character level"* — was decided and then not built:
  `Skill` had no such field and nothing asked for one, so all twenty-two were open from the
  first minute and V1's ladder meant nothing inside the game. The `unlock` column is now in
  the requirement gate, in `canCraft`, and in `buyStock` for a skill's tools. Every unlock is
  bought with focused time and nothing else — no material, no coin, no other skill stands in
  front of it — which is what makes it safe to put in a gate that can otherwise deadlock an
  account. A processing skill must never open in front of the gathering skill feeding it: a
  test walks every recipe and asserts each skill can run one on the day it opens, which is the
  same rule as *"a skill with no recipes is a skill written down"* applied to the calendar
  rather than the catalogue. `game-audit.mjs` prints the ladder in hours, which is the only
  unit an unlock can honestly be judged in — level 20 reads very differently from 93 hours.
- **The first weapon can be made the day the first fight opens.** "Each skill can run one
  recipe on the day it opens" was true of Smithing because of the pickaxe, and it hid that
  every weapon took a plank: Smithing opens at 2, beside the first area, and Fletching at 8,
  so the gate that asks for no gear let a character in at offence zero for the first eleven
  hours with no way to make anything to hold. A melee weapon takes charcoal now, which is what
  §4's chain always drew — planks go to bows, staves and arrows — and since a charcoal and a
  plank are both two logs and one refining action, the weapon costs what it always did. The
  unlock ladder did not move. Two tests hold it: one walks a fresh account, with no shop and
  no starter kit, to the level the first area asks for and makes a weapon that lifts the odds
  off the floor; the other asks every skill that makes weapons to make one the day it opens.
- **Every slot a gate counts can be made by the level that gate opens.** The gate reads the
  shallowest of ten slots and an empty one is tier zero. Eight are the armourer's; a ring and an
  amulet are the jeweller's, and Jewelcrafting opened at 16 while the first area asking for a set
  opens at 5. Until then the two could only drop — a median of fifty-four sessions in the meadow
  for the pair, and then again at every tier — so everything past tier 2 sat behind luck for the
  first fifty hours. Jewelcrafting opens at 4 now. The gate was not touched: making it forgive
  two slots until a level arrives would have been a gate that asks for something other than a
  tier. A test asks it of every area and every boss, at the level each one asks for.
- **Nothing is hard-deleted.** Superseded state goes to `game_state_backup`; a merged
  project keeps its row pointing at where its hours went.
- **Levels ratchet.** XP can fall; the level cannot. Prestige is the single sanctioned
  reset, and even then `peak_level` remembers.
- **The chain is derived, never stored.** `chain.ts` reads the session table and works out
  what the next session pays. Storing a multiplier would let it drift from the ledger — which
  is why the log derives each entry's links at read time, with a lookback so the oldest row on
  a page cannot undercount. Its step depends on the session's LENGTH, so anything computing it
  has to pass the minutes.
- **Pure rules take `now` as an argument.** `session-engine`, `streak-engine`, `game-day`,
  `levels`, `projects`, `chain` and `prestige` have no database and no clock of their own. That is
  what makes them testable; keep new rules that shape.

  Everything under `src/lib/game/` follows it too, with no database and no clock between them.
  The services (`activity-service`, `inventory-service`, `game-view-service`,
  `game-stats-service`) are the only things that touch Postgres. The list of modules that used
  to stand here said "twenty" and named twenty-one, in a directory of twenty-six.
- **An achievement may only read a statistic something records.** V1 shipped fifteen that could
  never fire. `GameStats` was built before V2's 224 definitions for that reason, and
  `tests/game.test.ts` sweeps every predicate against a maxed game — the deliberately
  contradictory hidden ones are exempted *by name*, so an exemption is a decision.
- **A unique's effect is typed or it says it is not.** `effects.ts` has sixteen kinds the engine
  applies; anything else is `descriptive`, which means named, intended and inert. A modifier
  written as prose that looks like it fires is worse than one that admits it does not.
- **A typed effect must have a reader, and a test that proves it.** The whole set shipped once
  with `foldEffects` written and never called, which made all 250 uniques cosmetic — by exactly
  the standard the line above sets. Every kind in `IMPLEMENTED` now changes an outcome and
  `tests/game.test.ts` asserts it does. Adding a kind means adding both.
- **A cost written in a constant is not a cost.** `AMMO_COST` existed for a week and nothing
  spent ammunition, so all four styles fired free and the ladder that makes style choice
  economic did not exist. Same for durability: `resolveCombat` returned `durabilityUsed` and
  nothing applied it, so gear never wore and `repairAll` had nothing to mend. If a number
  describes a price, something has to charge it.
- **Consumables are spent at ENTRY, not at resolution.** Wards and tonics leave the bank when
  the session starts, so abandoning does not give them back — that is what "spent on entry"
  means, and it is what makes the cost real. `chooseActivity` re-checks the gate before
  spending, because `offers` ran against holdings a client cannot be trusted to still have.
- **Gunfire must sit at the top of the net ladder.** It is the style you switch to when flush,
  so there has to be something on the other side of the bill; a style that costs most and earns
  least is not expensive, it is strictly worse. `game-audit.mjs` prints net per style and has
  now caught two wrong versions of these numbers.
- **Spend from what is held, never from an id you assume exists.** Rations were spent from
  `ration:{areaTier}` while the gate counted them at any tier, so fighting a tier-9 area with
  tier-3 rations passed the gate and then drove the balance negative. Rations, ammunition and
  upgrade stones all now walk what is actually owned — cheapest first for rations and stones,
  highest tier first for ammunition.
- **V1's achievement set is frozen at 131.** V2 is a second list and `ALL_ACHIEVEMENTS` is the
  union. Adding a game did not change what V1 means.
- **A session settles once, and the status transition proves it.** The same rule as the
  milestone below, and it was missing for two years: `completeRow` and `abandonRow` read the
  row, then updated it by id, then called `applyDelta` — so two reconciles overlapping both
  saw a running session and both banked it. A live account's `game_state_backup` carried four
  sessions with two `session-complete:<id>` writes apiece. There is no interactive transaction
  on the Neon HTTP driver, so the claim is a single conditional UPDATE: the WHERE narrows to
  the statuses a running session can be in, exactly one caller comes away having changed the
  row, and only that one pays. An integration probe races four reconciles at one session;
  without the guard it banks four.
- **An abandon is only charged to whoever decided it.** §3 lists four triggers under one −30
  and treats them as one thing. Two of them are a person choosing to stop — `gave_up` and
  `superseded` — and those keep the penalty. The other two were the app deciding on somebody's
  behalf, and neither can happen any more. `heartbeat_lost` is an *inference*, and the spec
  already knows it is unreliable: phone sessions have no heartbeat at all to avoid "false
  abandons", and desktop browsers freeze backgrounded tabs now too, while §3's own rule is about
  existence — *"Other tabs do not matter. Only the page's existence is checked."* A frozen tab
  exists. `pause_budget` and `pause_count` no longer end anything either; see below.
  `abandonWasChosen` is the single question, and three things read it: the penalty, the
  completion ratio, and the streak. It is applied in `abandonRow`, in `loadActivity` and in
  `db:recompute` — all three, because a rule enforced where the row is written but not where the
  counters are rebuilt survives exactly until the next rebuild.
- **The pause budget is a budget, not a trap.** Running out of the five minutes used to abandon
  at −30 and lose everything focused so far, so a six-minute break cost more than never having
  started — and it landed on somebody who had told the app they were stepping away. It restarts
  the clock instead: `pausedMsUsed` caps what a pause can bank, the time past the cap counts as
  focus, and the session finishes five minutes later than it would have. That is the whole cost.
  `evaluate` returns a running verdict carrying `resumedAt` so every reader simply sees a running
  session, and `reconcile` writes the resume back under a status guard before judging again —
  without that the row stays `paused` for ever, the pause and resume actions gate on a status
  that is no longer true, and the session can never complete. Pressing Pause with nothing left is
  refused rather than forfeited: the button is already disabled, so abandoning there was a trap
  behind a control you could not press.
- **A milestone is paid once, ever, and the marker proves it.** `applyDelta` does not
  deduplicate by reason, so anything paying a lump into the ladder inserts a `world_progress`
  marker with `onConflictDoNothing` and pays only when it created a row. Never trust a caller
  not to fire twice — a server action can be retried and a button can be double-clicked, and a
  milestone that pays twice inflates the ladder with nothing to show it happened.
- **The loadout is read at resolution, so a live session freezes it.** `equip-service` refuses
  while a session is active, paused or awaiting its report. Allowing a swap would change a
  fight already underway and would let the requirement gate be passed in one set and fought in
  another — and it is refused with a reason, never a disabled button that does not say why.
- **An instance never passes through the ledger, so tell the collection log directly.**
  Equipment is a row in `equipment_instance`, not a stack, and `logCollected` exists because
  the alternative was writing a +1 and a −1 into an append-only ledger to cancel out. A ledger
  whose value is that every row means something cannot afford rows that mean nothing. Found and
  crafted gear both go through it; forgetting would make collection achievements silently
  unearnable, since they read the log and not holdings.
- **A session says what it came to, and the record is the say.** `ResolutionSummary` was
  built on every completed session and its one caller dropped it, so a fifty-minute fight that
  stopped after four minutes for want of ammunition reported "+1250 XP banked" and nothing
  else. It is now written into `session_activity.result` in the *same statement* that sets
  `resolved_at`, so a settled session always has a record of what settled it, and a retry —
  which the guard makes a no-op — can still read back the first call's result. It is a
  description of writes already made, never a derived total: `db:recompute` has nothing to
  rebuild in it, and nothing re-rolls to display it, because yield is seeded from the session
  id precisely so a roll is reproducible. Re-deriving it from the ledger is impossible anyway —
  coins and fuel go through the wallet, skill XP to `skill_state`, a milestone is a
  `world_progress` marker with no session on it, and salvaged gear leaves no trace at all.
- **A skill with no recipes is a skill written down, not built.** Alchemy and Jewelcrafting
  shipped with a note, a fuel cost, a level curve and zero recipes — the same shape as
  `AMMO_COST` existing while nothing spent ammunition. And Gem was declared as a mining line in
  the catalogue and consumed by runecrafting while no session produced one, so the only skill
  that could not be started was the one whose input nothing made. `tests/game.test.ts` now
  asserts every processing skill has recipes, every recipe input is obtainable from gathering,
  farming or another recipe, and every gathering skill's output is consumed by something —
  and it has no exemptions left: excavation was the last one, and relics refine into upgrade
  stones now.
- **An id is spelled in one place, and the catalogue is that place.** `rollDrops` built its
  equipment ids from a string template, and for weapons the template was wrong: a weapon is keyed
  by ARCHETYPE — `weapon:Snapedge:7:fine` — while the template wrote the style and the slot, so
  every weapon ever dropped came out as `weapon:melee:weapon:7:fine`, a row that has never
  existed. Armour was correct only by coincidence, its own id being exactly what the template
  happened to write. It went to the bank, the collection log and the result screen and rendered
  as "melee weapon 7 fine", and from the other end it meant 2,184 of the 2,730 weapons in the
  catalogue — every quality above Plain, the ones that can only be *found* — were obtainable by
  nothing at all. `equipmentOptions` asks the catalogue what exists instead, so there is no
  second copy of the naming rule to drift; an empty answer is a real answer, since firearms have
  no material below tier 6. A test sweeps every shape a kill can mint.

  It also carries the ARCHETYPE, which the template had no way to know. That is not cosmetic:
  `centre` takes a weapon's power from `archetype.damage` and `band` its width from
  `archetype.bandPct`, so a found weapon was rolled against the flat slot fallback and was not
  the weapon it claimed to be — and `equipItem` reads the same field to decide whether a
  two-hander gives up the offhand, which is the whole of what a two-hander costs.
- **A game screen talks to the player about their character, not to a reader about the design.**
  Every `/game` screen opened on a paragraph of rationale: Slaying explained why daily contracts
  were rejected, the Shop why there is no market, Crafting that its recipes are "generated from
  the tier spine", and the Shop's upgrades block carried the commit message for salvage-to-stones.
  Equipment printed its cost curve "at tier 12" and the Shop its price formula. All of it is true
  and none of it is for the person holding the character. The reasons live in SPEC-V2.md and in
  comments; the tables live in the wiki; a screen says what you have, what it can do, and what
  to do next.
- **The overview leads with a route, and a step is a gate, a recipe or a contract, quoted.** A
  level-22 character stood on that page with no weapon, five empty slots, no contract and four
  bare plots, and it reported all of it accurately and suggested nothing. `game/guide.ts` is the
  requirement gate turned around: the gate names what is missing so a refusal reads as a
  shopping list, and the guide names the next thing worth doing so a status page reads as a
  route. It invents no number — every step is something another module already decides — and
  it is pure, so a test stands a fresh account in front of it and reads what it says.
- **A weapon lands `hits` times an exchange, and offence reads every one.** §16.2 words a fast
  weapon as "two hits an exchange at D 0.38" and a volley as "three at D 0.32", and offence read
  D alone — so six weapons at one price ran from 0.32 to 0.95, a full set built round the best
  had 1.8 times the offence of one built round the worst, and a lone Fellmaul out-killed a full
  Snapedge set three to one. `exchange` is damage times hits and `loadoutPower` applies it at the
  read, not in `centre`: an instance stores its roll, so folding hits into the band would have
  left every multi-hit weapon already made below its own floor. `SPAWN_BASE` moved from 33 to 48
  with it, because the yardstick set is built round a two-hit weapon and the rule it is fitted to
  — a same-tier Plain set converts about four commons in five — is the thing being kept, not the
  number. `GUARD_BASE` is defence's own scale for the same reason: rations were priced off
  `SPAWN_BASE`, and a coat is not thinner because offence was re-read. The audit's reference
  lines came out within a point of where they were. Still prose, and `archetypes.ts` says so:
  the crit, the free opening hit, the guard, and an ammo bill per hit — ammunition is charged
  per kill, which the audit decided twice.
- **A fight says what it will come to before the minutes are spent.** The gate for the first two
  tiers asks for no gear, so it waved an unarmed character into fights they lost nineteen times
  in twenty, and the only thing the activity list said about it was "6 monsters". The list, the
  areas screen and the boss rows all print the odds from the loadout actually worn.
- **A boss fight is one function, and the audit prints it.** Resolution asked
  `bossKillSeconds(offence, 1)` and the result screen asked `bossKillSeconds(boss.tier, offence)`,
  so every boss took 450 seconds whatever was worn and every lost roll was reported as "not long
  enough". `bossFight` is the single account of a fight — power, effective offence, seconds,
  chance — read by the resolver, both screens and `game-audit.mjs`.
- **The style that answers a fight has to exist at its tier.** The rule read "guns cannot be the
  answer before the gun line opens" and then swapped out bosses whose *own* style was gun. The
  answer to a boss is the style that beats it, and gunfire beats melee: the first boss in the
  game asked for a firearm three tiers before one exists. `answerTo` is spelled once, in
  `archetypes.ts`.
- **Every unique has a source, and a test walks all of them.** Only a boss's first kill ever
  granted one, so 40 of 250 existed in play and three "find N uniques" achievements could not
  fire. A boss's repeat kills now roll its own table, the first contract finished in a biome
  gives up that biome's trinket, and the rest turn up on later contracts. The sweep against a
  maxed game did not catch this, because a maxed game was assumed to hold all 250.
- **A contract's claim is one conditional UPDATE, and it says what it paid.** Same shape as a
  session settling: the WHERE narrows to a contract still open, one caller comes away with
  `completed_at` set, and only that one pays the purse. §7 lists four rewards and one was paid,
  in silence — the result screen never mentioned the contract the kills had just finished.
- **A two-handed weapon stands in for the offhand at the gate.** "`hands: 2` may move throughput
  and conversion but NEVER access" was the rule, and the gate counted ten filled slots. `gateTier`
  in `power.ts` is the one reading, and the screens call the same function the gate does.
- **A list that truncates has to say so, or not truncate.** The picker showed twelve rows a group
  and all six gathering skills shared one group, so Hunting and Excavation could not be chosen
  at any tier by a character who had opened both.

- **The game is set at the size a game is read at, and the timer is not.** The app's type scale
  was drawn for one number and a button. Ten screens of things to compare, at 13px on the
  faintest of three greys in a 900px column, was a page you leaned in to. `.game` in
  `globals.css` moves the three reading sizes up a step and the two quiet inks toward the text,
  scoped to the game layout so Timer, Streak and the rest keep the scale they were tuned at.
  Change a size there, not per screen.
- **The display face marks a name somebody wrote.** §8 gives Fraunces to the earned title "so
  the name reads as a name". The game has thousands of generated names and a few hundred written
  ones — biomes, bosses, uniques — and set identically, Thistlemaw's Grin read like one more row
  of Copper. `.named` extends the rule to the world's proper nouns and nothing else: never a
  heading, a label or a generated item.
- **A slot is drawn as a slot, and an action is a button.** Gear was a bar chart and then a
  table; plots were rows reading "empty". Anything that holds one thing or visibly holds nothing
  is a box or a dashed outline, and an empty one carries the control that fills it. Second-rank
  actions were twelve-pixel underlined words — "Sell", "Take off", "max 48" — which is how a
  link looks, at a size a thumb cannot hit; `.btn-quiet` and `.chip` are the two shapes they
  take now, and the one filled button on a screen is still the primary action.

- **Milestone XP stays a garnish.** The ladder is ~600,000 XP; V1's achievements are ~27,000 and
  the milestones are ~37,000, both under 8%, and a test holds the line. Anything that pays into
  the ladder competes with focused minutes for the meaning of a level.

- **Latency is waves, not queries.** The Neon HTTP driver sends one request per query, so what
  a page costs is not how many reads it does but how many of them had to *wait* for an earlier
  one. `buildSnapshot` — which every button returns and the heartbeat asks for every fifteen
  seconds — was eight waves deep for thirteen reads, and the depth was all accidental: the
  prestige view was awaited after a batch that had already loaded the `game_state` it re-read,
  `chainHistory` looked like it needed the live session but applies that exclusion as a JS
  filter, and `advanceStreak` sat in front of reads it shares no table with. Two waves now, and
  a third of the wall time.

  The shape to watch for is a wait that does not look like one: `potions: await potionsHeld(id)`
  inside a returned object literal was a whole round trip in `loadGateState`, on the path of
  every timer page load. `const a = await x(); const b = await y();` is the same bug spelled
  out. Before adding a read, ask what it needs from the one above it — usually nothing, and
  then it belongs in that `Promise.all`.

  Lend a *promise*, not a value. `bankUsage` takes `Wallet | Promise<Wallet>` because handing it
  the value forces the caller to await first, spending a wave to save a read — the wrong way
  round, since a read running beside others is free and a wait never is.

## Hand-written prose may not quote a figure

The wiki generates everything it can, and the one thing it cannot generate — the doc
registry that names the documents — is the one thing that went stale: V2's blurb read
"21 skills, ~326 items … Designed, not built" for days after V2 was 22 skills, 8,568 items
and built. `src/lib/wiki/v2.ts` had drifted twice the same way before it was made to compute
everything.

So a blurb says what a document is *about* and the page prints the figures from
`v2Figures()`. A test asserts no blurb contains a digit, and it is absolute even where the
figure is frozen — exempting the safe ones is how the habit dies.

## Explaining a number to the user

If a figure on screen is the product of a multiplier, the screen has to say so. The session
log showed XP with no account of itself for weeks — the chain, prestige stars and the slack
penalty all fold into one number, and none of them were visible. A number the user cannot
take apart is a number they cannot trust, and they will assume the smallest of the possible
explanations.

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
