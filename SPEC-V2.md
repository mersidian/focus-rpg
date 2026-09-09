# Focus RPG — V2 Spec: Skills, Fuel, Combat

A Melvor Idle-flavoured skill economy layered onto shipped V1: 22 skills, 8,568 generated items,
1,710 recipes, ten equipment slots across four combat styles, refinement, 250 uniques, 40
bosses, 224 achievements, and generated monster combat across 200 areas in 20 biomes.

**Status: built.** Sections marked **DECIDED** are settled, and §13 lists what is still open.

What exists: twenty pure rule modules under `src/lib/game/` — 24 tiers, 24 weapon archetypes,
90 species, 20 biomes, 200 areas, 709 monster variants, 8,568 items, 1,710 recipes, 250
uniques, 40 bosses — the numeric balance model, ten database tables, five services, ten
`/game` screens, an activity picker on the timer, and 224 achievements wired into the shipped
engine. **279 unit tests pass**, and `scripts/game-audit.mjs` reports the live balance figures.

What does not exist: the four proposals in §15, and whatever §13 still lists.

V1 is [SPEC-V1.md](SPEC-V1.md) and is closed. Its section numbers are cited by ~150 code
comments and must not be renumbered.

---

## 1. What this changes about V1 — **DECIDED**

V1 §1 cut, under *"Explicitly cut (do not build)"*: combat, enemies, HP, damage, dungeon
runs, depth, descend-or-extract, loot, gear, rarity, classes, blacksmith, gold, crafting,
skill trees, the idle town and offline resource generation.

**V2 reintroduces most of it**, at the author's explicit request — the condition CLAUDE.md
sets on reversing a cut.

### Permanently cut. No version may add these.

- **Idle and offline progression.** Nothing accrues while the user is away. This is the
  invariant the whole app rests on: *"The server owns progression. XP comes only from
  sessions the server timed."* Every V2 mechanic is driven by timed focus or by an explicit
  user action, never by a clock.
- **Real-time combat.** No live combat screen. Combat resolves from timed minutes. A screen
  that demands attention would compete with the work the app exists to protect.
- Classes · multiplayer · leaderboards · social.
- **Melvor skills that are clock-driven:** Agility, Astrology, Township, Summoning. Each
  needs real time to pass, which is the one thing that may not happen here.

### V1 amendments V2 requires

- V1 §1's cut list: annotated (done).
- V1 §7: the 400 XP freeze purchase becomes **coins** (§2).
- V1 §10 risk 1 — *"no decisions left in the loop"*: V2 answers it. Preparation before a
  combat session is a real choice with real inputs.

---

## 2. Currencies — **DECIDED**

| | Earned from | Spent on | Behaviour |
|---|---|---|---|
| **XP** | focused minutes | nothing | never spent — identity, feeds V1's 100-level ladder |
| **Fuel** | completed sessions | processing and crafting actions | **no decay** |
| **Coins** | **selling items, monster drops** | shop: tools, upgrades, repairs, gear | accumulates freely |

### Load-bearing rules

- **Coins never come directly from focusing.** They must always be laundered through an
  *item* — mined and sold, or dropped. If a completed session ever pays coins directly,
  coins and fuel become one currency with two names and the economy collapses to a single
  number.
- **XP stays unspendable.** 131 achievements and the whole prestige system sit on it.
  Consequence: V1 §7's 400 XP freeze purchase moves to **coins**.
- **Fuel does not decay** (author's decision). Whether it is **capped** is open — see
  §12.4. Without either decay or a cap, fuel becomes unbounded and every crafting cost
  eventually rounds to free.

---

## 3. Focus becomes gathering — **DECIDED**

**The session is the action**, with fuel layered on for small work.

Melvor's core structure is "pick one activity, it ticks." A pomodoro is already a chosen
block of time that ticks, so the mapping is direct and needs no idle loop.

```
                    ┌─ Woodcutting ─→ logs
                    ├─ Fishing ─────→ fish
  a focus session ──┼─ Mining ──────→ ore, gems, essence
   (15/25/50 min)   ├─ Foraging ────→ herbs, silk, fibre
                    ├─ Hunting ─────→ hides, bone, sinew
                    ├─ Excavation ──→ relics
                    └─ Combat ──────→ drops + coins
```

- **Minutes are the only input to yield.**
- 50-minute sessions yield proportionally more, consistent with their +20% XP bonus.
- The **chain multiplier** (`src/lib/chain.ts`) applies to yield as well as XP.
- **The server resolves all yield from timed minutes.** No client ever reports what it
  found — same rule as XP, same reason.
- **An abandoned session yields nothing** and still costs −30 XP.

### The session is recorded live — **DECIDED**

The heartbeat already fires every 15 seconds (V1 §3). It is extended to persist progress:
focused minutes so far, the provisional yield accumulating, the skill and character XP in
flight.

**Recorded is not credited.** Nothing banks until the session completes — otherwise
abandoning would leave loot in your hands, which contradicts the line above. The live record
exists so that a refresh, a closed tab or a move between devices mid-session loses no
progress and shows the true state on return.
- **Combat is a focus session too** (author's decision), not a fuel purchase. This is what
  keeps fuel's job small: fuel pays only for trivia that should never consume 25 real
  minutes.

### Dungeons — **CUT**

Explored and dropped by the author. Combat is single areas and monsters, no chained floors,
no escrow, no forfeit. The chain multiplier still rewards back-to-back sessions the way it
already does for everything else.

---

## 4. Between sessions, fuel does the small work — **DECIDED**

```
  Woodcutting → logs ──[Firemaking]──→ charcoal ──┐
  Mining ─────→ ore ───────────────────────────[Smelting]──→ bars ──[Smithing]──→ melee plate, tools
  Hunting ────→ hides ─[Leatherworking]──→ leather ──→ ranged hide
  Woodcutting → logs ──[Fletching]────→ planks ──→ bows, staves, arrows
  Foraging ───→ silk, fibre ─[Tailoring]→ cloth ──→ magic robes
  Fishing ────→ fish ──[Cooking]──────→ rations
  Foraging ───→ herbs ─[Alchemy]──────→ potions
  Mining ─────→ essence ─[Runecrafting]→ runes
  Mining ─────→ gems ──[Jewelcrafting]→ rings, amulets, trinkets
                                          │
  monster drops ←──── Combat sessions ←────┘
```

The Melvor loop, closed: gather in sessions → process with fuel → equip → fight in sessions
→ drops that cannot be gathered → deeper areas.

---

## 5. Two taggings per session — **DECIDED**

- **Activity** — what your *character* does (Mining). **Chosen before every session**, as an
  explicit commitment: the requirement gate has to be evaluated before the timer starts, so
  a missing ration or the wrong equipped style is visible *before* you spend 50 minutes, not
  after. There is no sticky default and no retroactive claiming — you cannot decide a
  session was combat once you have seen the roll.

  The cost is accepted: pressing start now always carries a choice, where in V1 it carried
  none. The timer screen must therefore show the current gate result at a glance, so the
  choice is a glance and not a errand.
- **Project** — what *you* actually did (Thesis). Unchanged; still collected in the shipped
  report card (V1 §6).

Orthogonal: one is the game, one is your life. The V1 self-report flow is untouched.

---

## 6. Skills — 22 — **DECIDED**

### Gathering — the session is the action

| Skill | Yields |
|---|---|
| Woodcutting | logs (5 tiers) |
| Fishing | fish (6) |
| Mining | ore (6), gems (6), rune essence |
| Foraging | herbs (6), silk, plant fibre |
| Hunting | hides (5), bone, feathers, sinew |
| Excavation | relics, artefacts — the coin skill |

### Combat — the session is the action

| Skill | Levels from |
|---|---|
| Melee | melee-style kills |
| Ranged | ranged-style kills |
| Magic | magic-style kills |
| Gunplay | firearm kills |
| Slaying | contract targets, grants uniques |

### Processing — paid with fuel, between sessions

| Skill | Chain |
|---|---|
| Firemaking | logs → charcoal |
| Smelting | ore + charcoal → bars |
| Smithing | bars → melee plate, tools |
| Leatherworking | hides → leather → ranged hide |
| Fletching | logs → planks → bows, staves, arrows |
| Tailoring | silk + fibre → cloth → magic robes |
| Cooking | fish + meat → rations |
| Alchemy | herbs → potions |
| Runecrafting | essence → runes |
| Jewelcrafting | gems → rings, amulets, trinkets |
| Gunsmithing | saltpetre + sulphur → gunpowder → cartridges, firearms |

### Tools — **DECIDED**

Gathering needs a tool, and the tool gates the resource. **576 tools** are budgeted in §9:
8 gathering skills × 24 material tiers × 3 qualities.

**Two separate locks on the same door.** Mithril ore needs Mining 45 *and* a mithril-tier
pickaxe — one earned with time, one bought with materials. A session's yield is bounded by
whichever of the two you neglected.

- Tool tier **above** the requirement improves yield, exactly as equipment above a combat
  requirement improves the loot roll (§7). The gate is binary; everything above it is
  graded.
- This is deliberately the same two-key structure as the combat requirement gate, so one
  mental model covers both halves of the game rather than two.
- It also gives Smithing a purpose that is not combat gear. The first mithril pickaxe is a
  goal that is felt.

Tools take durability wear from use and go **Worn** rather than breaking, as equipment does.

### Farming — a fourth gathering line — **DECIDED**

Farming is the one skill that had to be adapted rather than adopted, because it is
inherently clock-driven and this app has no clock but your focus.

**Plots advance one growth stage per completed session** — never per real hour. §1 forbids
anything that moves while you are away, permanently.

#### Why it is not redundant

A full fourth gathering line risks being *"the same thing but slower"* — content you build
and never open. Two decisions prevent that.

**1. Farming never takes a session.** It is the only skill that is not an activity you can
choose. You plant with fuel, every completed session advances *every* plot by one stage
whatever you were actually doing, and you harvest with fuel. So Farming does not compete
with Foraging, Woodcutting or Hunting for session time — it competes for **patience and plot
slots**. The trade is real and it is not a worse version of anything: those three give bulk
immediately for the cost of a session; Farming gives less, later, for free.

**2. Farming is the only source of some materials.** Not a slower path to the same things:

| Line | What it grows | Why the wild cannot supply it |
|---|---|---|
| **Herbs** | 24 tiers of herb | Foraging finds them, but only in the biome you happen to be in |
| **Fibre crops** | flax, cotton, silkworm feed → the whole **cloth ladder** | above tier 8 cloth is **farm-only**, which finally gives Magic's armour a real source line |
| **Saplings** | hardwood | yields **one tier above** what can be chopped in the wild |
| **Livestock** | hides | **guaranteed tier**, where Hunting's hides roll |

So Magic's material chain runs through Farming the way Melee's runs through Mining, and
Hunting keeps its job — volume and monster parts — while Farming owns precision.

#### The plot system

- **Start with 4 plots**, expandable with coins. Another sink, and the one that gates how
  much of the cloth ladder you can run at once.
- **Maturity is measured in completed sessions**, scaled by tier: a tier-1 crop takes 2, a
  tier-24 crop takes 30. That makes a high-tier cloth run a month-long background
  commitment, decided once and then paid for by simply working.
- Seeds come from Foraging, from monster drops, and from the shop. **~48 seeds** in the
  catalogue, four lines across the tier spine.
- A mature plot does not spoil. Nothing in this app punishes you for being away.

### Skill levels — **DECIDED**

**Melvor-style 1–99 per skill.** Each skill has its own level and XP curve. Levels unlock
resources (Mining 30 → Mithril), recipes, and area requirements. The Skills page becomes
the game's main screen.

**Per-action mastery was considered and cut.** Melvor tracks a separate 1–99 for every ore,
tree and monster; a shallow 1–10 version was designed and rejected as too harsh. With 850
actions it could never be completed, and it was a third grind axis stacked on skill levels
and refinement. Skill levels already reward repetition — at the level of the skill rather
than the individual resource, which is enough.

Cost noted honestly: 22 skills × 99 levels is 2,178 levels to place and balance. The curve
must be generated from a formula per skill archetype, not hand-tabulated.

---

## 7. Combat — **DECIDED**

### Biomes, areas and monsters are generated — **DECIDED**

Nothing at this scale is hand-written. All three come from axes:

| | Arithmetic | Count |
|---|---|---|
| Biomes | hand-shaped, each with a tier range and a skill affinity | **20** |
| Areas | 20 biomes × 10 areas | **200** |
| Species archetypes | grouped in ten families | **90** |
| Monsters | 90 archetypes × the biomes whose tiers suit them | **709** |

A **species archetype** carries the behaviour — kill-time, type on the style wheel, part
table. A **biome variant** carries the tier, the flavour and the name. An Ashen Wolf and a
Rime Wolf are one archetype in two biomes, and they are not the same fight.

Drop tables are generated from monster tier × biome, never written per monster.

#### Parts are keyed to the species, not the variant

This is the decision that keeps the catalogue healthy. If each of the 709 variants had its own
parts that would be **2,127 items** — a quarter of the entire catalogue would be pelts, and the
bank would be an endless list of *Ashen Wolf Pelt*, *Rime Wolf Pelt*, *Tidal Wolf Pelt*.

Instead:

- **Each of the 90 archetypes has 3 parts.** A Wolf drops Wolf Pelt in every biome. **270
  items.**
- **Each of the 20 biomes has 3 biome materials**, dropped by anything living there. **60
  items.**
- A Rime Wolf therefore drops Wolf Pelt *and* Rime Salt. The variety lives in the
  *combination*, which is where a crafting economy wants it, and the item count stays sane.

### Gating is open, by tier — **DECIDED**

Every biome states a **tier requirement** plus any key item, and you may go anywhere you can
meet the gate. That gives a soft ordering without a corridor, and costs nothing to build
because the requirement gate below already does the whole job.

On top of that sit **three key-item gates**, at the points where the game should visibly
change shape:

| Gate | Unlocks | Found in |
|---|---|---|
| Sulphur and saltpetre | Gunsmithing and the entire gun line | Ashfall Ridge |
| A Rimeworks cipher | the last three biomes | Sunken Cathedral |
| A Voidscar sigil | Sunspire, the endgame biome | Voidscar |

Linear chaining and a branching tree were both rejected: a chain makes the world a corridor,
and a tree needs three or four routes balanced as equally viable — a real balancing job with
no payoff a tier gate does not already provide.

### The 20 biomes

Each is tied to a gathering skill, so the economy interlocks rather than running in parallel
lanes: the mine wants Mining and drops ore you cannot mine.

| # | Biome | Tiers | Skill affinity |
|---|---|---|---|
| 1 | Sunlit Meadow | 1–2 | Foraging |
| 2 | Whispering Wood | 2–4 | Woodcutting |
| 3 | Tidepool Flats | 3–5 | Fishing |
| 4 | Rootdeep Thicket | 4–6 | Woodcutting, Hunting |
| 5 | Abandoned Mine | 5–7 | Mining |
| 6 | Saltmarsh | 6–8 | Fishing, Foraging |
| 7 | **Ashfall Ridge** | 7–9 | Mining — sulphur, and the gun unlock |
| 8 | Sunken Shore | 8–10 | Fishing |
| 9 | Deep Seam | 9–11 | Mining |
| 10 | Bramblewild | 10–12 | Foraging, Hunting |
| 11 | Frostbite Tundra | 11–13 | Hunting |
| 12 | Glasswaste | 12–14 | Excavation |
| 13 | Fungal Hollow | 13–15 | Foraging |
| 14 | **Sunken Cathedral** | 14–16 | Excavation — the Rimeworks cipher |
| 15 | Obsidian Caldera | 15–17 | Mining |
| 16 | Stormcrag Peaks | 16–18 | Hunting |
| 17 | Blightfen | 17–19 | Foraging |
| 18 | The Rimeworks | 19–21 | Excavation, Mining |
| 19 | **Voidscar** | 21–23 | all — the Sunspire sigil |
| 20 | Sunspire | 23–24 | endgame |

### The 90 species archetypes

Ten families, so behaviour is designed once per family and varied per archetype:

| Family | Count | Examples |
|---|---|---|
| Beasts | 12 | wolf, boar, bear, elk, rhino, crocodile |
| Insectoids | 10 | spider, mantis, hive-drone, burrower |
| Undead | 10 | revenant, drowned, bone-knight, wight |
| Constructs | 9 | rock golem, iron sentinel, clockwork |
| Elementals | 9 | cinder, rime, gale, tide |
| Draconic | 8 | drake, wyvern, wyrm, basilisk |
| Aberrations | 8 | gloomworm, watcher, void-touched |
| Humanoids | 10 | bandit, cultist, poacher, deserter |
| Fungal and plant | 7 | bark ent, thornling, sporeling |
| Aquatic | 7 | siren, reef lurker, kraken-spawn |

Each archetype fixes a type on the style wheel, a kill-time and its 3 parts. Every archetype
gets a variant in each biome whose tier range it suits, which is what turns 90 designs into
**709 monsters**.

> **Measured, not estimated.** An earlier draft of this section claimed ~1,800, on the
> assumption that every archetype appears in every biome. It does not — a species only appears
> where its tier band overlaps the biome's — and `scripts/game-audit.mjs` reports the real
> figure. The number above is what `allVariants()` returns.

### Bosses — 40, two per biome — **DECIDED**

Every biome has a **mid-boss** and a **biome lord**. They are fought as ordinary focus
sessions, not as a special mode — the difference is entirely in the gate and the reward.

- **A boss demands a tier band two above its biome's floor**, so it is the wall that says
  "come back better," not a coin flip.
- **The first kill always drops that boss's signature unique.** Guaranteed, no roll —
  because a 2% chance on a fight you can attempt once a week is not a reward, it is a tax.
- **Repeat kills** roll normally against the boss table, with the unique at a low rate for
  a second copy at a better stat band.
- Bosses have no rarity ladder: a boss is its own rarity.

| # | Biome | Mid-boss | Biome lord |
|---|---|---|---|
| 1 | Sunlit Meadow | Thistlemaw | The Gilded Hare |
| 2 | Whispering Wood | Oakenshade | Hollow-Antler |
| 3 | Tidepool Flats | Brinescuttle | The Pale Tide |
| 4 | Rootdeep Thicket | Bramblewretch | Old Rootfang |
| 5 | Abandoned Mine | Cavelight | The Third Shift |
| 6 | Saltmarsh | Reedmother | Fenlantern |
| 7 | Ashfall Ridge | Cinderjaw | Emberthrone |
| 8 | Sunken Shore | Wrackmaiden | The Drowned Choir |
| 9 | Deep Seam | Seamwyrm | Blackvein |
| 10 | Bramblewild | Thornsovereign | The Wild Hunt |
| 11 | Frostbite Tundra | Rimehowl | The White Elk |
| 12 | Glasswaste | Mirrorstride | The Sand Sermon |
| 13 | Fungal Hollow | Sporecrown | Mycelia Prime |
| 14 | Sunken Cathedral | The Kneeling Saint | Choirmaster Vell |
| 15 | Obsidian Caldera | Glassflame | The Obsidian Ordinal |
| 16 | Stormcrag Peaks | Skyfracture | The Gale Warden |
| 17 | Blightfen | Rotmother | Plaguewright |
| 18 | The Rimeworks | The Cold Engine | Warden Null |
| 19 | Voidscar | Scarborn | The Unmaking |
| 20 | Sunspire | Solmourn | The Last Light |

### Slaying — a persistent contract ladder — **DECIDED**

Slaying's job is to be the voice that says *go here next*. With 200 areas, ~1,800 monsters
and open tier gating (no corridor), the world needs one.

- **One contract at a time, and it never expires.** Take it, and it waits — across a week of
  scattered sessions if that is how the week goes.
- **Slaying level unlocks contract tiers.** Higher tiers name deeper biomes and rarer
  variants, so the ladder doubles as a guided route through content that otherwise has no
  suggested order.
- Rewards: coins, Slaying XP, upgrade stones, and the skill's own uniques.

**Daily contracts were rejected.** Three-a-day-or-lose-them is a login incentive, and this
app already has a healthier one in the streak. Expiring dailies would manufacture exactly
what every other decision here has avoided: a reason to feel bad for not opening the app.

### The requirement gate — **DECIDED**

Server-checked on entry, and **binary**. Skill level · equipment tier · consumables (spent
on entry) · key item · character level. Fail any and the activity is not selectable —
greyed out with the missing requirement **named**, so it reads as a shopping list rather
than a refusal.

**No RNG on whether you may go.** RNG lives only in rewards.

### How a session resolves — **DECIDED**

A 25-minute combat session is **N kills**, not one fight. Kill count = minutes ÷ the
monster's kill-time, improved by gear. Loot rolls per kill, so a longer session is a fatter
drop list. The chain multiplier applies.

**Every spawn rolls a rarity:** Common → Uncommon → **Elite** → Rare → **Legendary**.
Rarity sets both the loot table and the spawn's power.

**Your loadout has an effective power** = gear tier + style match. Meet or beat the spawn's
power and the kill is **guaranteed**. Below it you get a sliding %, **never zero**, so a
Legendary is always at least a lottery ticket.

### The style wheel — **DECIDED**

Four styles, in a cycle rather than a triangle:

**Melee → Ranged → Magic → Gun → Melee**

- Melee beats Ranged: it closes the gap.
- Ranged beats Magic: it interrupts casting.
- Magic beats Gun: wards turn projectiles.
- Gun beats Melee: it pierces plate at range.

Right style against a monster's type is a large power bonus, wrong style a penalty — a
Legendary that is 25% in the wrong style can be 80% in the right one. This is what makes
preparation, chosen before the session, pay off. A four-cycle is a harder puzzle than a
triangle: there is no style that is merely "safe".

Each style has its own armour line: plate, hide, robes and — for firearms — coats and
bandoliers. That fourth line is where roughly 800 of the catalogue's items come from.

### Loot rarity comes from the monster, not from gear — **DECIDED**

A Legendary Fire Drake drops Legendary loot whether killed in steel or mythril. Gear works
through three channels instead:

| Channel | Effect |
|---|---|
| **Access** | which areas may be entered — hard-gated |
| **Conversion** | % to beat over-tier spawns |
| **Throughput** | faster kill-time → more spawns → more rolls |

Why: if gear boosted loot rarity directly, the optimal play would be full gear in the
*easiest* area. Under this model the optimal play is fighting the hardest things you can
reliably convert.

**Luck belongs on trinkets** — explicit drop-rate modifiers you trade a slot for, never a
passive consequence of tier.

### Ammunition — **DECIDED**

Every style except melee consumes something, and the cost ladder is what makes the four
styles economically different rather than merely different on the wheel.

| Style | Consumes | Chain | Cost | Damage ceiling |
|---|---|---|---|---|
| Melee | nothing but durability | — | none | lowest |
| Ranged | arrows, bolts, darts | Fletching: logs + metal | cheap | low-mid |
| Magic | runes | Runecrafting: essence | medium | high |
| Gun | cartridges, shells, cells | Gunsmithing: gunpowder | expensive | highest |

- **Damage scales with upkeep.** Melee is the zero-cost style with the lowest ceiling; guns
  are the opposite. Choosing a style therefore becomes an *economic* decision as well as a
  tactical one — melee on a week you are broke, guns when you are flush — and it is made in
  the preparation phase where every other decision in V2 already lives.
- **It keeps three crafting skills permanently relevant.** If ammunition were free, Fletching
  and Runecrafting would be finished content within two months of making your gear.
- Running out mid-session is the same class of event as running out of rations (below): a
  preparation failure, never a punishment for the minutes just spent.

Mana was considered for Magic and rejected: anything that refills over real time is idle
progression, which §1 forbids permanently. Refilling per session would have made Magic a
second free style and flattened the ladder above.

### Failure costs — **DECIDED**

A failed kill costs **1 ration** and **1 durability** on the weapon. It never costs the
session: the session still completes, still pays XP, still banks every kill that landed.

- At 0 durability an item becomes **Worn** — power roughly halved. **Never destroyed**,
  which preserves *"nothing is hard-deleted."*
- Repair costs coins, scaled by tier. **Auto-repair is a toggle**: with it on and coins
  available, gear repairs itself at session start. The user should never see a repair
  screen unless broke.

Rations drain and durability wear are both paid out of stockpiles built *before* focusing,
so nothing is ever taken mid-session. Running dry is a planning mistake, not a punishment.

---

## 8. Equipment — **DECIDED**

**Ten slots, style on everything:** head, body, legs, boots, gloves, cape, amulet, ring,
weapon, offhand. **Four styles × one 24-tier material spine × 5 qualities**, generated rather than written —
`power = slotBase × tierMultiplier × styleAffinity × qualityWindow`.

Names follow the style: melee is **plate** (Steel Platebody), ranged is **hide** (Wolf Hide
Chaps), magic is **robes** (Ashen Robe Top), firearms are **coats** (Oiled Ranger's Coat).
Twenty-four tiers named four ways, and five qualities, cost nothing to name because the
generator does it.

Then **~200 hand-authored uniques** that deliberately break the curve. Only these need real
design attention, and only these are memorable.

### One material spine, four naming families — **DECIDED**

**A single 24-tier ladder**, worn by four naming families. Tier 9 is tier 9 in power
whatever you wear; only the name changes.

| Style | Family | Example at tier 9 | Tiers |
|---|---|---|---|
| Melee | metal — *plate* | Mithril Platebody | 1–24, and all 576 tools |
| Ranged | hide — *hide* | Wyvern Hide Chaps | 1–24 |
| Magic | cloth — *robes* | Shadowweave Robe Top | 1–24 |
| Gun | composite — *coats* | Oiled Ranger's Coat | **6–18** |

**Guns enter at tier 6**, once saltpetre and sulphur appear in deep mining. That is
deliberate pacing: the early game is a triangle, and a fourth way to fight *follows from*
digging deeper rather than being announced. It also thins an early game that would otherwise
drop 22 skills and four styles at once.

#### Why one spine, and what it saves

Four independent ladders of different lengths were considered and rejected. They would have
made tier numbers incomparable — "iron tier or better" means nothing to someone in robes —
which forces every requirement gate, recipe and drop table to carry a per-style mapping, or
else a normalised "power band" layer sitting between tiers and gates.

One spine deletes that layer entirely:

- **A gate is a tier number.** An area requires tier 7; metal 7, hide 7 and cloth 7 all
  satisfy it identically.
- **One curve to balance**, not four that must be kept equivalent.
- The generator names 72 materials across four families at no cost, so the flavour that
  independent ladders were supposed to buy is bought by naming instead.

The one asymmetry kept is the gun line's late entry, which is pacing rather than balance.

### Three independent axes on every item — **DECIDED**

The author rejected prefix/suffix affixes. Variance lives in the numbers instead, which
keeps the catalogue finite and browsable while making an individual drop worth reading.

1. **Rolled stats.** Every catalogue item carries stat *ranges*, not fixed numbers — a
   Mithril Spear is `damage 42–58`. Each drop rolls inside the band, and the item card shows
   the roll *and its position in it*: `51 damage (42–58 · 64%)`. That percentage is the
   hook; a 97% roll is a keeper and you know it instantly.
2. **Quality** shifts the *window*, not the roll. Masterwork Mithril is `52–68`. Quality and
   luck are separate things you can feel apart.
3. **Refinement, +1 to +10.** Each level consumes an **upgrade stone** matched to the item's
   material tier, plus coins, and raises stats by a percentage on top of roll and quality.

Every roll is seeded from the session id, so `db:recompute` reproduces it exactly (§10.2).

### Refinement — **DECIDED**

- **+N counts toward effective power.** Refinement is therefore a real alternative to
  finding better gear: grind stones to force your way into the next area, or go and find a
  higher material tier. It is the first choice in V2 that does not need a session to make.
- **Failure costs the stone and the coins, and nothing else.** The item keeps its current
  +N. Nothing downgrades, nothing is destroyed — consistent with *"nothing is
  hard-deleted"*, and with an app that has never taken anything away.
- The honest consequence: every item reaches +10 eventually, so refinement is a **time tax
  rather than a gamble**, and the *cost curve* has to carry the entire axis. Stone costs
  escalate steeply and high tiers demand high-tier stones, so +10 on a Mythic weapon is a
  project rather than an afternoon.
- Display: `Mithril Spear +7 · 68 damage`, with base band, roll percentage, quality and
  refinement all legible separately.

---

## 9. Item budget — 8,568 generated — **DECIDED**

Ten thousand items is not an authoring target, it is a product of axes. Nothing on this
list is typed out by hand except the uniques.

| Class | Arithmetic | Items |
|---|---|---|
| Weapons | 6 archetypes per style × (24 + 24 + 24 + 19) tiers × 5 qualities | 2,730 |
| Armour | 9 slots × (24 + 24 + 24 + 19) tiers × 5 qualities | 4,095 |
| Jewellery | 4 types × 24 gems × 8 metals | 768 |
| Tools | 8 gathering skills × 24 tiers × 3 qualities | 576 |
| Ammo | 6 types × 24 tiers | 144 |
| Monster parts | 90 species × 3, plus 20 biomes × 3 materials | 330 |
| Gathered raws | logs, fish, ore, gems, herbs, hides, cloth, essence, bone, saltpetre, sulphur, relics | ~220 |
| Refined | bars, planks, leather, cloth, runes, alloys, gunpowder, dyes, oils | ~180 |
| Consumables | potions 30 effects × 6 tiers · 80 foods · 60 scrolls · 40 bombs · 40 cartridges | ~400 |
| Upgrade stones | 24 tiers × 3 kinds | 72 |
| Charms, seeds, artefacts, decor | 48 seeds across four crop lines | 620 |
| Hand-authored uniques | ~118 named in §9, the rest to follow | 250 |

### What the generator actually produces

The table above was the estimate. `src/lib/game/items.ts` is the generator, and this is its
output — every figure below is asserted by a test, so it cannot drift from the code:

| Class | Items |
|---|---|
| Armour | 4,095 |
| Weapons | 2,730 |
| Tools | 576 |
| Parts | 270 |
| Consumables | 204 |
| Raw materials | 192 |
| Refined | 187 |
| Ammunition | 134 |
| Upgrade stones | 72 |
| Biome materials | 60 |
| Seeds | 48 |

**8,568 items, every id and every name unique.**

The estimate ran ~1,800 high for two honest reasons, both now fixed in this document rather
than papered over. Jewellery was counted twice — amulets and rings are two of the ten slots, so
they were already inside the armour line. And per-variant monster parts were dropped in favour
of per-species parts, which is the right call for the bank and costs ~1,850 items.

Getting to 10,000 from here is one config change — a decor line, a 26-tier spine, or five
qualities on tools instead of three. It is deliberately **not** done: 8,568 items that are
balanced by one formula are worth more than 10,000 that are not.

**Content is data, not code.** One typed content file of axes and generators, so changing
the size of the game is a config change and never a migration.

### What this scale forces

- **The bank cannot be a grid you scroll.** Search and filter first, always.
- **Balance cannot be hand-tuned.** Every stat falls out of a formula, so a Masterwork
  Mithril Spear +7 is correct by construction rather than by inspection.
- **Drop tables are generated** from monster tier × biome.
- **The wiki stops being a nicety.** At ten thousand items it is the only way the author can
  see their own game.

### The bank — **DECIDED**

**Limited slots, expandable with coins.**

- **A slot holds an item type, and stacks are unlimited within it.** Four thousand iron ore
  is one slot. This is the difference between a bank that costs a decision and a bank that
  costs an afternoon, and it is not negotiable — counting quantity against the limit would
  turn every gathering session into a sorting job.
- **Equipment instances each take their own slot.** Rolled stat bands (§8) make every drop
  distinct, so equipment is where the pressure actually lands — which is also where the
  decision is interesting: *is this 78% roll worth a slot?*
- **Start at 60 slots**, expandable to roughly **1,500** at escalating coin cost. With
  ~10,230 item types you can never hold everything, so what to keep is a permanent, live
  question. Slot purchases are the economy's largest coin sink.

**Auto-salvage rules are part of this decision, not a nicety.** A filter set once — *sell
anything below a 60% roll, always keep above 90%* — means the flood never reaches the bank
at all. A limited bank without them is the inventory-management minigame this app cannot
afford; with them, the bank is somewhere you go deliberately.

### The shop — **DECIDED**

**Buying and selling both happen at the shop.** It is a destination screen, not a panel that
follows you around: coins only change hands in one place.

- Sells: tools, seeds, upgrade stones, ammunition, rations, bank slots, fuel-cap upgrades.
- Buys: anything you bring it, at fixed prices by item class and tier.
- Repairs Worn equipment, with **auto-repair** as a toggle that spends coins at session start.

**Fixed prices, no market simulation.** A fluctuating economy is a spreadsheet minigame, and
watching a price chart is precisely the kind of attention this app exists to protect.

The bulk problem is real and is answered by the **auto-salvage rules** above rather than by
selling from everywhere: most of a session's drops are converted on the way in and never
reach the bank, so a trip to the shop is a decision about the things you actually kept.

### The collection log — **DECIDED**

A limited bank breaks the Collection achievements of §12 on its own: *"every item of one
material tier"* is 570 items and the bank starts at 60 slots.

So the **collection log** records every item type ever obtained, permanently and separately
from the bank. Collection achievements read the log, never current holdings — you have to
have *found* it, not still be *holding* it. Selling a Legendary never erases the fact that
you had one, which is the same principle as a merged project keeping the row that says where
its hours went.

The log is also the game's bestiary and its wiki-in-app: at ten thousand items it is the
only honest answer to "what have I actually seen?"

### The uniques — ~118 named, the rest generated

The catalogue's 10,000-odd items come from the generator. These do not: each one deliberately
breaks the curve with a modifier no generated item has, and each is the reason a particular
fight is worth repeating. Names are original, written in the genre's tradition rather than
borrowed from any specific game.

**Melee weapons**

| Name | Slot | Breaks the curve by |
|---|---|---|
| Thistlemaw's Grin | dagger | rolls its stat band twice and keeps the better |
| Hollowfang | sword | ignores the style wheel penalty entirely |
| The Third Shift | pickaxe-sword | counts as a mining tool two tiers above itself |
| Rootfang | greatsword | +damage per consecutive floor of the same biome |
| Emberthrone | mace | failed kills cost no durability |
| Cold Engine Ram | spear | refinement costs half the stones |
| Widow's Tithe | axe | +yield on the session's *last* kill only |
| Kneeling Saint | mace | heals one ration per ten kills |
| Blackvein Cleaver | axe | +damage against Constructs, −against Beasts |
| Solmourn | greatsword | its band widens by 1% per character level |
| Gilded Hare's Tooth | dagger | fastest kill-time in the game, lowest damage |
| Unmaking Edge | sword | every 50th kill is guaranteed Legendary rarity |
| Pale Tide | spear | +damage in Coastal biomes, useless in Volcanic |
| Antler of the Wild Hunt | polearm | +damage the longer the session |
| Sand Sermon | flail | converts 10% of damage into Excavation XP |
| Warden's Null-Rod | mace | suppresses a monster's biome modifier |

**Ranged weapons**

| Name | Slot | Breaks the curve by |
|---|---|---|
| Skyfracture | longbow | arrows are never consumed on a killing blow |
| Rimehowl Draw | shortbow | +damage in Tundra, +50% arrow cost everywhere else |
| The Drowned Choir | crossbow | fires three times per shot at a third damage each |
| Bramblewretch Sling | sling | uses biome materials as ammunition |
| Old Poacher's Kit | crossbow | +rare drop chance against Beasts |
| Thornsovereign | longbow | +damage per unspent bank slot |
| Fenlantern | shortbow | reveals a hidden area in each biome |
| Wrackmaiden's Line | harpoon | doubles Fishing yield when equipped, even out of combat |
| Mirrorstride | crossbow | its rolled band is copied from the last unique you found |
| Whisper-Nock | longbow | silent: elites never spawn while it is equipped |
| Scarborn Recurve | shortbow | +damage against Aberrations, cannot hit Undead |
| Gale Warden's Arc | longbow | ignores tier gate by one band |
| Hare-Foot Sling | sling | +throughput, −loot quality |
| Last Light Bow | longbow | one guaranteed Legendary per game day |

**Magic weapons**

| Name | Slot | Breaks the curve by |
|---|---|---|
| Mycelia Prime | staff | spreads: kills seed a bonus drop on the next session |
| Choirmaster's Baton | wand | runes cost coins instead of essence |
| Glassflame | orb | +damage, and durability falls twice as fast |
| Sporecrown Tome | tome | converts monster parts into biome materials |
| Rotmother's Censer | orb | damage over the session rather than per kill |
| Oakenshade Branch | staff | +Woodcutting yield while equipped |
| Cavelight | orb | lights Underground biomes: +throughput there |
| The Obsidian Ordinal | tome | rerolls one stat band per session |
| Reedmother's Reed | wand | rations are never consumed |
| Seamwyrm Coil | staff | +damage per tier of the material you are wearing |
| Void Sermon | tome | +damage against everything, −max HP band |
| Brinescuttle Focus | wand | converts fuel into damage |
| Rime Sigil | orb | freezes a boss's tier requirement by one band |
| White Elk Antler | staff | grants one free Slaying contract reroll per day |

**Firearms** *(tier 6 and above)*

| Name | Slot | Breaks the curve by |
|---|---|---|
| Emberthrone Repeater | rifle | cartridges craft in half the fuel |
| Cinderjaw | shotgun | hits every spawn in the room once |
| Warden Null | revolver | ignores a monster's style advantage |
| Blackvein Drill-Gun | rifle | doubles as a tier-20 pickaxe |
| The Sand Sermon Piece | revolver | +damage per relic in the collection log |
| Skyfracture Carbine | rifle | no cartridge cost on elites |
| Plaguewright's Bore | shotgun | poisons: kills continue after the session ends |
| Glasswaste Derringer | pistol | tiny band, never misses |
| Rimeworks Autoloader | rifle | +throughput per refinement level |
| Solmourn Hand-Cannon | pistol | one shot per session, guaranteed Legendary |
| Scarborn Scattergun | shotgun | converts durability loss into coins |
| The Last Volley | rifle | +damage as your ration count falls |
| Fenlantern Flare | pistol | +rare drops, wakes elites |
| Choir Piece | revolver | fires runes instead of cartridges |

**Armour**

| Name | Slot | Breaks the curve by |
|---|---|---|
| Thistlemaw Hide | body | +yield on every gathering session |
| Cloak of the Wild Hunt | cape | +chain multiplier by one link |
| Hollow-Antler Helm | head | shows spawn rarity before the kill resolves |
| Third Shift Boots | boots | +throughput in Underground biomes |
| Drowned Choir Mantle | cape | rations restore twice |
| Rimehowl Pelt | body | immune to Tundra tier penalty |
| Glassflame Greaves | legs | +damage, no defence at all |
| Kneeling Saint's Habit | body | refinement never fails |
| Sporecrown Cowl | head | +Foraging yield, −combat power |
| Emberthrone Plate | body | durability never falls below Worn |
| Gale Warden's Wings | cape | ignores one key-item gate |
| Blackvein Gauntlets | gloves | +Mining yield, +ore quality band |
| Voidscar Shroud | cape | hides you from elites entirely |
| Sand Sermon Wraps | gloves | +Excavation yield, doubles relic rate |
| Last Light Crown | head | +XP to every skill at once |
| Fenlantern Lamp-Harness | body | reveals area requirements before entry |
| Mirrorstride Sabatons | boots | copies the last boots you wore |
| Rootfang Bracers | gloves | +Woodcutting, logs never burn wrong |
| Pale Tide Scale | body | +power in Coastal, −everywhere else |
| Warden Null Visor | head | suppresses all biome modifiers, yours included |

**Jewellery and trinkets**

| Name | Slot | Breaks the curve by |
|---|---|---|
| Ring of the Third Shift | ring | +1 bank slot per tier refined |
| Gilded Hare's Charm | trinket | +throughput, −rare drop rate |
| Thornsovereign Signet | ring | +rare drop chance, flat |
| Wrackmaiden's Pearl | amulet | Fishing yields double, Cooking costs nothing |
| Cinderjaw Ember | trinket | +damage per unspent fuel |
| Choirmaster's Chain | amulet | runes never consumed on a killing blow |
| Rimeworks Cog | trinket | refinement stones stack to a higher tier |
| Voidscar Sigil | amulet | +power, and every failure costs two rations |
| Unmaking Band | ring | rerolls a drop's stat band once per session |
| Mycelia Spore-Locket | trinket | gathering sessions also yield biome materials |
| Solmourn Sunstone | amulet | +XP to the character ladder specifically |
| Old Rootfang's Knot | ring | +yield the longer the session |
| Sand Sermon Scarab | trinket | relics never duplicate until all are found |
| Blackvein Nugget | ring | ore yields one band higher |
| White Elk Token | amulet | one free Slaying contract skip per week |
| Pale Tide Shell | trinket | +power on rest days |
| Fenlantern Wick | trinket | +elite spawn rate, +their loot |
| Last Light Circlet | amulet | every hundredth kill drops a unique |

**Tools**

| Name | Skill | Breaks the curve by |
|---|---|---|
| The Third Shift Pick | Mining | mines two tiers above its own |
| Oakenshade Axe | Woodcutting | logs never fail to double |
| Wrackmaiden's Rod | Fishing | catches one band above the water |
| Rootfang Sickle | Foraging | herbs yield in threes |
| Poacher's Snare | Hunting | hides never come damaged |
| Sand Sermon Trowel | Excavation | relics at double rate, artefacts at half |
| Cavelight Lantern-Pick | Mining | no throughput penalty in the dark |
| Rimehowl Skinner | Hunting | +yield in Tundra, useless in Volcanic |
| Mycelia Trowel | Foraging | Fungal Hollow yields count twice |
| Blackvein Auger | Mining | converts 10% of ore into gems |
| Glassflame Tongs | Smelting | bars smelt for half the fuel |
| Cold Engine Hammer | Smithing | refinement uses one fewer stone |

### On borrowing from other games

Systems are free to take, and this design takes plenty: gathering loops, tier ladders,
rolled stat bands, refinement, a style wheel. Specific item *names*, descriptions and lore
from a particular game are that game's writing and are not copied. It is moot in practice —
ten thousand names could never be hand-written, and the generator produces them for free.

---

## 10. Architecture

### 10.1 The inventory ledger — **DECIDED**

CLAUDE.md: *"The ledger is truth. `focus_session` is the record; `game_state`, `day_ledger`
and `streak_state` are running totals of it. Where they disagree, the ledger wins —
`npm run db:recompute` rebuilds what is derivable."*

**An inventory is not derivable from the session ledger.** Yield is, given a deterministic
roll. But *spending* is a decision — smelting three ore, selling a fish, equipping an axe —
exactly like spending a freeze, which CLAUDE.md already carves out as *"a decision, not a
fact."*

**Chosen: an append-only inventory ledger.** Every grant and every spend is a row; a balance
is a fold over the rows, never a number mutated in place.

- **Grants derive from `focus_session`.** Given a session and a seed, the yield roll
  reproduces exactly, so a grant can always be rebuilt.
- **Spends are decisions and are replayed, never recomputed.** Smelting three ore, selling a
  fish, refining a spear — `db:recompute` replays them in order against corrected rules
  rather than guessing at them. This is the same carve-out CLAUDE.md already makes for
  spending a freeze.
- **Balances are derived.** Nothing stores a quantity as fact. Where a cached balance and
  the ledger disagree, the ledger wins, exactly as it does for `game_state`.

The trade accepted: the table gets large — one user, years of play, ten thousand item types,
plausibly hundreds of thousands of rows. That is affordable, and it buys the property that
actually matters: a bug in a spend rule is fixed by correcting the rule and replaying, not
by hand-editing quantities. The same property that made the mistagged session and the
two-session spotless month recoverable.

Rejected: balances-as-state (fast, but a spend bug is permanent because there is no history
to replay), and the hybrid (fast *and* rebuildable, but it creates two truths that can
disagree, and then something has to arbitrate between them).

### 10.2 Yield must be deterministic per session — **DECIDED**

Every roll — yield quantity, spawn rarity, drop table, conversion success, **stat bands and
quality** — is seeded from the session id. A recompute must reproduce it exactly. A non-deterministic roll makes the
ledger unrebuildable, which breaks the app's central invariant.

### 10.3 Pure rules keep their shape — **DECIDED**

New rule modules — yield, combat resolution, crafting, equipment power, skill curves — have
no database and no clock, same as `session-engine`, `chain` and `prestige`. They take `now`
as an argument.

### 10.4 Nothing is hard-deleted — **DECIDED**

Selling or consuming writes a spend row; it never deletes a grant. Worn equipment is never
destroyed.

---

## 11. Character integration — **DECIDED**

Interleaved *narrowly*, with exactly two seams and no more:

1. **Skills gate on character level**, so V1's 100-level ladder acquires a new meaning
   without being touched. Mining unlocks at a character level; Volcanic biomes want a high
   one.
2. **Prestige does not reset the bank.** Items, coins, skill levels and refinements survive
   a prestige, which makes prestige more tempting rather than more punishing.

**A skill session pays both.** Twenty-five minutes of Mining gives 25 character XP *and*
Mining XP. The game must feed V1's ladder, never divert from it — otherwise choosing an
activity would mean choosing to slow your own character down, and the whole system would
be resented.

### Milestones pay character XP too — **BUILT**

Beyond the per-minute rate, the game's own progress pays into V1's ladder in lumps:

| Event | Character XP |
|---|---|
| A skill level — but only **10, 25, 50, 75, 90, 99** | 20 · 50 · 130 · 260 · 380 · 520 |
| Unlocking a biome | 250 |
| The first +10 refinement in a material tier | 100 |

**Why only six levels a skill.** Twenty-two skills at 99 is **2,178 level-ups**. Paying each
one enough to feel like anything runs to hundreds of thousands of XP and turns the ladder into
a by-product of the game; paying each one within budget means about 15 XP a level, which is
less than a fifteen-minute session and therefore not a moment at all. Six levels that pay
properly is the resolution.

The whole set is **37,320 XP, 6.2% of the 600,000 the ladder runs to** — in line with V1's
131 achievements at ~27,000, and held there by a test.

**Paid once, ever.** `applyDelta` does not deduplicate by reason, so a `world_progress` marker
does it: the insert is `onConflictDoNothing` and the XP is paid only when it created a row. A
milestone that fired twice would inflate the ladder silently, which is the worst shape a bug
can take here. Those same markers are what `/game` reads back to show what was paid — the
record of payment is the record of the event.

This does not breach *"XP comes only from sessions the server timed"*: skill levels advance
only from timed sessions, so milestone XP still derives entirely from timed focus — it is
merely paid in lumps rather than per minute.

Accepted consequence: **Mythic V arrives sooner than 10,000 literal focused hours.** V1 was
already like this — 131 achievements pay XP — so the ten-thousand figure was always the
shape of the curve rather than a promise about the clock.

### Projections extend to every axis — **DECIDED**

V1 has `src/lib/projection.ts` for the next character rank. V2 extends it to every track,
estimated from the trailing 14-day focus rate the dashboard already computes — and, for a
skill, from how often that skill is actually chosen rather than from total focus:

> **Adept III → Adept IV** — 420 XP, ≈ 6 days at your current pace
> **Mining 34 → 35** — ≈ 3 days at your current rate on Mining
> **Smithing 61 → 62** — ≈ 2 weeks
> **Gunplay 99** — ≈ 8 months

It must degrade honestly: no history means no estimate, and vacation or rest days must not
be read as a collapse in pace.

Everything else sits beside V1. Skills keep their own levels, and `levels.ts`,
`prestige.ts`, the achievement engine and the dashboard are not rewritten. Full merge —
character level as the sum of skill levels — was rejected: it would mean re-deriving four
working, tested modules, and with 22 skills and 10,000 items still to build, that is the
worst available trade.

---

## 12. Achievements — 224 new, in 10 families — **BUILT**

V1's 131 stay exactly as they are — `ACHIEVEMENTS` is still that list and every test written
against it still asserts 131. V2's are a second set, and `ALL_ACHIEVEMENTS` is the union the
engine judges: **224 new, 355 in total**.
Where a family says *generated*, the achievements come from the content axes rather than
being typed out — one per biome, one per material tier — which is the only way a catalogue
this size can be covered at all.

| Family | Count | Shape |
|---|---|---|
| **Gathering** | 36 | 100 / 1,000 / 10,000 units in each of the six skills (18); the first resource of each material tier (18, generated) |
| **Combat** | 30 | 100 / 1k / 10k / 100k kills; the first Elite, Rare and Legendary spawn; 100 Legendary kills; every species in a biome (12, generated); one of each of the 60 archetypes |
| **Exploration** | 24 | unlock each biome (12, generated); clear every area in a biome (12, generated) |
| **Crafting** | 30 | the first craft in each of the ten processing skills; 100 / 1,000 / 10,000 items crafted; an item of every material tier (18, generated) |
| **Collection** | 36 | every item of one material tier (18, generated); a full armour set in each style (4); 1,000 / 5,000 / 10,000 distinct items owned; all 200 uniques |
| **Refinement** | 16 | the first +5 and +10; 10 / 50 / 100 items at +10; a +10 in every material tier |
| **Gunplay** | 12 | the first firearm kill; 1,000 cartridges fired; a gun at +10; a full coat set; beat a Magic-type monster *with a gun*, which is the bad matchup on the wheel |
| **Economy** | 16 | 1k / 100k / 1M / 10M coins earned; sell 10,000 items; raise the fuel cap to its maximum; spend 100,000 fuel |
| **Meta** | 10 | earn 50 / 100 / 150 / 200 V2 achievements; complete a V2 family |
| **Hidden** | 12 | silhouettes with a family hint, as in V1 |

Two rules carried over from V1, both load-bearing:

- **Tests are written from this document's wording**, not from the implementation. That is
  how fifteen V1 bugs were found, several of them achievements that could never have fired.
- **Nothing may promise a finish line that does not exist.** No achievement may require
  something the arithmetic rules out — the rule that killed per-action mastery, and the same
  rule that must be checked against every generated collection achievement before it ships.

---

## 12.5 Where the game lives in the UI — **DECIDED**

**One top-level `/game` entry with its own sub-nav** — exactly the pattern `/wiki` already
uses, so it is proven in this codebase and costs one layout plus one client nav component.

Nav goes from 8 destinations to 9, not to 17.

| Under `/game` | Holds |
|---|---|
| Skills | 22 skills, their levels, and what each unlocks next |
| Areas | 20 biomes, 200 areas, each with its gate result already evaluated |
| Equipment | ten slots, four styles, the loadout and its wheel position |
| Bank | slots, stacks, and the auto-salvage rules. **Search and filter first, always** |
| Collection | the permanent log of every item type ever obtained; the bestiary |
| Crafting | the ten processing skills and their recipe trees, priced in fuel |
| Farm | plots, crop lines, stages remaining in completed sessions |
| Slaying | the current contract and the ladder above it |
| Shop | buying, selling, repairs, bank slots, fuel-cap upgrades |

### Why a section and not nine destinations

It keeps the **productivity surface and the game surface visually separate**. Timer, Streak,
Dashboard and Log are what this app *is*; the game is what it *pays you in*. Folded together,
every V1 screen becomes half-game, and the screens that currently do one job well stop doing so.

### Two constraints that hold regardless

- **The timer stays the home page and the default landing.** With 22 skills and 10,385 items the
  gravity of the game will pull toward making it the front door. The day that happens, this app
  has quietly become something else.
- **The game disappears during a session.** `Chrome.tsx` already strips the nav while a session
  runs and until the report is logged. The game surface is bound by the same rule: for the length
  of a session the page has exactly one job.
- The timer screen carries **one** game element — the chosen activity and its gate result, at a
  glance — because §5 requires the gate to be legible before the timer starts, not after.

---

## 13. Open questions

1. **The between-session actions.** Sessions produce things and the screens show them, but
   almost nothing can be *done* with them yet: refinement has an action, and crafting,
   equipping, selling, planting a plot and taking a contract do not. Until they exist the loop
   runs one way — gather or fight, watch the bank fill — and §4's "gather → process → equip →
   fight" is only half true. This is the largest remaining gap and it is not a small one.
2. **The four researched proposals in §15** — each fills a verified hole and costs almost no
   items, but none is decided.
3. **Eight uniques are named but not wired.** Of the 250, eight carry a `descriptive` effect —
   named, intended, and doing nothing, because the engine has no way to express them yet
   (revealing a hidden area, suppressing elite spawns, a contract reroll). They say so rather
   than pretending; `effects.ts` types the other 242.

---

## 14. Build phases — complete

The author chose to build the whole thing at once rather than in a vertical
slice, so these describe what landed rather than an order anyone followed.

- **E1 — Skills spine.** Activity selection on a session, the six gathering skills, seeded
  yield resolution, the append-only inventory ledger with derived balances, the bank with
  its slot limit, the collection log, skill levels, and `db:recompute` extended to replay
  spends. **Done.**
- **E2 — Fuel and processing.** Fuel currency, the ten processing skills, recipes, the
  content file. **Done.**
- **E3 — Equipment and coins.** Ten slots, four styles, the generator and its axes, rolled
  stat bands, quality windows, coins, selling, shop, repairs. **Done.**
- **E4 — Combat.** Generated biomes, areas and monsters, the requirement gate, rarity
  spawns, the style wheel, generated drop tables, rations and durability. **Done.**
- **E5 — Guns and refinement.** Gunsmithing, the saltpetre → gunpowder → cartridge chain,
  the coat armour line, upgrade stones and +1 to +10. **Done.**
- **E6 — Milestones and projections.** Milestone character XP: **done**, and visible on
  `/game`. Projections exist for character rank (V1) and skill level, not for every track.
- **E7 — Bosses and Slaying.** 40 bosses with guaranteed first-kill uniques, the persistent
  contract ladder. **Done.**
- **E8 — Depth.** Farming's four crop lines and the plot system, the 250 uniques, and the 224
  achievements of §12. **Done**, except the eight descriptive effects noted in §13.

---

## 15. Researched additions — **PROPOSED, not decided**

A research pass read Dungeon World's monster rules, Warframe's mod system, The Division 2's
Gear 2.0 and recalibration, and a Minecraft-modpack RPG wiki's reforge/gem model, then adapted
each candidate against the invariants and put the survivors through adversarial critics.

Fourteen candidates were adapted, four rejected outright, and six more killed by the critics.
**Four survived.** None is adopted — they are recorded here with their strongest objection so
they can be decided rather than re-argued.

### 15.1 The finding that matters more than the proposals

> Eight of the ten proposals were competing bids on **two holes**, which is why they collided so
> badly and why only one per hole could survive.

**Hole 1 — the biome variant and the 200 areas are mechanically empty.** §7 asserts that an
Ashen Wolf and a Rime Wolf *"are not the same fight"*, but it also fixes the wheel type on the
**archetype** and gives the variant only tier, flavour and a name. As decided, **~1,800 monsters
are 90 fights in 20 coats of paint**, and the style wheel — which §7 calls the puzzle
preparation exists for — is answered once per archetype and never asked again.

**Hole 2 — the weapon archetype axis is mechanically dead.** §9 budgets weapons as *6 archetypes
per style × tiers × qualities = 2,730*, and nothing anywhere says what an archetype **does**.
`offhand` appears exactly once in this document, in the ten-slot list. So ~2,275 weapons and
~455 budgeted offhands differ by name alone. Worse, §7 says kill count is *"improved by gear"*
while §8's `power = slotBase × tierMultiplier × styleAffinity × qualityWindow` has **no
throughput term at all** — gear-side throughput has no home.

Both holes are real defects in the design as it stands, whether or not the proposals below are
taken.

### 15.2 Proposal A — handedness, kill-time and throughput on the archetype rows

Add `hands: 1 | 2`, `killTime`, `powerPerKill` and one `role` field to the 24 weapon-archetype
rows. Two-handed forgoes the offhand slot and buys throughput or conversion in return; the
offhand finally means something.

- **Zero catalogue items.** Four fields on 24 rows already counted.
- **Hard narrowing:** handedness may move **Conversion and Throughput, never Access**. Letting it
  move Access would make gate satisfaction depend on weapon archetype, breaking §8's *"a gate is a
  tier number"* and making the greyed-out shopping list lie about what you are missing.
- **Objection:** saved loadout presets become a precondition. Though the style wheel already made
  presets mandatory — 25% wrong style versus 80% right, across ten slots and four styles — so this
  is not new debt.

### 15.3 Proposal B — `wheelStep` on the biome variant

One generated field, `wheelStep: -1 | 0 | +1`, on each of the ~1,800 variants, derived from
(family × biome tier band × skill affinity). **Static, never rolled per spawn, visible before the
timer starts.** A Rime Wolf and an Ashen Wolf then genuinely differ in what they are weak to.

- **Zero items, zero rows, zero achievements** — a field on rows already counted.
- Brings one generator **test** the design currently cannot write: *in every biome, each of the
  four styles is the right answer somewhere, and no biome is clearable with one weapon.*
- Must land inside **E4** with the generated monsters. Determinism matters here for the same
  reason it did in commit `f5692bf`.
- **Objection:** it is one more thing to read before a session, on a screen that must stay glanceable.

### 15.4 Proposal C — the entry-consumable gate rows

A 20-row *biome hazard → required consumable* mapping, which finally puts contents inside §7's
already-decided but **empty** *"consumables (spent on entry)"* gate clause. The 40 boss gate rows
generate from it.

- Fills the largest verified hole in §9: **~400 consumables are budgeted and the effect of not one
  of them is defined.** Alchemy is a full processing skill with a fuel cost and no customer
  anywhere in this document, and rations are consumed only by failed kills — so a pure gatherer
  currently buys nothing, ever.
- Binary, named in the greyed-out gate, no RNG, generated from 20 rows.
- Auto-consumed at session start, byte-for-byte the decided auto-repair pattern, and it never
  blocks starting.
- **Cut from the proposal:** graded magnitudes, a pace modifier, and any luck effect — luck belongs
  on trinkets (§7).

### 15.5 Proposal D — salvage to stones

One set-once `output: coins | stones` field on the auto-salvage rules, defaulting to coins, plus a
batched **downward-only** exchange at the shop and one `salvageYield` formula. Deferred to **E5**.

- **The hole:** §8 admits refinement's cost curve *"has to carry the entire axis"*, yet upgrade
  stones have exactly two faucets — Slaying, which is deliberately the slowest reward source in the
  design, and the coin shop, which also sells bank slots, *"the economy's largest coin sink."* So
  the deepest gear axis in V2 is funded by money, competing directly with the sink the economy is
  built around.
- Downward-only means shallow junk can never fund deep refinement.
- It also gives the already-authored unique **Rimeworks Cog** (*"refinement stones stack to a higher
  tier"*) a curve to break, which it currently does not have.
- **Objection:** it is tuning a ratio against a curve nobody has set yet.

### 15.6 Rejected, with reasons — so nobody re-proposes them

| Candidate | Why it died |
|---|---|
| **Instinct** — one infinitive verb per monster | The archetype already carries its behaviour via wheel type and speed class. Zero new axis, so zero generated content — which is the tell. |
| **Delivery tags** (close / reach / forceful) separated from damage | Premise is largely false, it duplicates four decided systems, and it would touch ~2,730 weapon rows to add a layer the ~250 uniques already cover. |
| **Socket × host-category effect matrix** | ~240 new item types and ~480 authored rows, almost none from an existing axis, and a direct duplicate of the hand-authored uniques. |
| **Paired-stat multiplicative curve with a derived soft cap** (crit rate × crit damage) | There is no HP, no attack loop and no crit here: §7 resolves a kill as one power comparison. |
| **Compositional tag vocabulary as an area card** | A display layer for a mechanic that does not exist, colliding with Proposal B for the same screen and the same word. |
| **Organization axis** (horde / group / solitary) | Count-versus-fatness is already delivered **four** times over, the rarity ladder included. |
| **Statless wardens / entry tolls** | ~25 hand-authored names plus ~25 hand-authored rewards, claiming the curve-breaker exception the 40 bosses already hold. |
| **The Ward** (a defence-category clause on the gate) | Self-defeating: the branch that keeps the world open converts it into a second combat system. |
| **Category-scoped roll pools with per-category caps** | Turns the item card from a scalar percentile into a 3-vector, and that percentile plus the one-line auto-salvage filter are the only things standing between the author and a 10,000-item sorting problem. |
| **Archetype identity as a behavioural rule enum** | A fourth item axis in all but name. §8 closed the axes at exactly three, deliberately. |

**Note on sources.** Five of the nine planned sources — Terraria, Melvor, Borderlands, osrsbox-db
and the D&D data sets — were not swept; the pass ran out of budget. Their absence is the main gap
in this section, and osrsbox-db in particular was to supply the **content-schema** advice for a
10,000-item catalogue, which is therefore still unwritten.

---

## 16. Content appendix — names, and the numbers that came with them

Generated by a research pass and kept verbatim except where noted. **All names here are
original**: conventions were borrowed from the genre, the words were not. Where an entry
carries a number — a tier gate, a power multiplier, a damage coefficient — that number is a
first draft, not a settled value; §13 records what is still missing.

Every pool states its **convention** first. The convention matters more than the entries: a
catalogue of ~10,385 items can only be named by a rule.

### 16.1 The 24-tier material spine

**Convention.** A material name is 1-2 words. Never three, never an apostrophe (apostrophes belong to the ~250 hand-authored uniques, so a name with one reads as unique on sight), never two stacked adjectives, never an abstract intensifier (no eternal-, infinite-, ultimate-, god-, -of-the-). RULE 1 — FAMILY MORPHOLOGY. Each family has one word-shape, applied to every tier: - metal: a bare substance word, or {root}+one of {steel, iron, cast}. Item = "{material} {plateNoun}". - hide: the beast alone; the family inserts the word Hide. Item = "{material} Hide {hideNoun}" (Boar Hide Chaps, Rimehorn Hide Cowl). Every beast-noun in the column is distinct: hare, boar, wolf, elk, bear, croc, hound, jaw, tusk, stag, back, moth, crawler, wyvern, scale, roc, basilisk, horn, wyrm, maw, born, coil, wing, mane. - cloth: a bare fibre word, or {root}+one of {weave, silk, lace, linen}. Item = "{material} {robeNoun}". - c

```
{quality} {material[family][tier]} {"Hide" if family=="hide"} {slotNoun[family][slot]} {"+"+refinement if refinement>0} → material[metal][tier] = MetalWord[tier] // "Seamsteel" → material[hide][tier] = Beast[tier] // "Longtusk", family inserts "Hide" → material[cloth][tier] = ClothWord[tier] // "Coalsilk" → material[composite][tier] = Treatment[tier-5] + " " + TechCloth[tier-5] // "Pitched Twill",
```

| Tier | Metal / Hide / Cloth / Composite | Gate and character |
|---|---|---|
| 1 | Copper / Hare / Flax / - | Gate 0 h, power x1.0. The starting kit, and the only band with no invented word in it: soft metal, small game, raw fibre. Composite is blank — the gun line has not opened. |
| 2 | Bronze / Boar / Hemp / - | Gate 1 h, x1.2. First alloy, first animal that fights back, first cordage. Still entirely mundane and entirely real. |
| 3 | Iron / Wolf / Wool / - | Gate 7 h, x1.4. The bare-noun tier: three words that need no modifier because everyone knows them. Wolf hide is the first pelt worth wearing. |
| 4 | Steel / Elk / Linen / - | Gate 22 h, x1.7. Steel arrives plain, before it starts taking prefixes. Linen is worked flax, so the cloth column is climbing its own real chain. |
| 5 | Crucible Steel / Bear / Silk / - | Gate 53 h, x2.1. The ceiling of the real world — genuinely the best historical steel, the largest ordinary beast, the finest ordinary fibre. Last tier before invented words are allowed. |
| 6 | Brineiron / Saltcroc / Reedweave / Tarred Canvas | Gate 103 h, x2.5. The salt tier, off the Saltmarsh: brine, salt, reed, tar — one idea, four words. Guns enter here, and their first coat is honestly just tarred canvas. |
| 7 | Ashsteel / Cinderhound / Emberlinen / Fire-cured Duckcloth | Gate 178 h, x3.0. Ashfall Ridge, where sulphur and saltpetre come out of the rock. The showcase row: ash, cinder, ember, fire — the tier a player can name from any one piece. |
| 8 | Wracksteel / Reefjaw / Tidesilk / Waxed Sailcloth | Gate 282 h, x3.6. The shore tier. Everything here is salvaged or fished rather than mined, which is why the metal is named for wreckage and the coat for a sail. |
| 9 | Seamsteel / Longtusk / Coalsilk / Pitched Twill | Gate 421 h, x4.3. The Deep Seam, and the mid-game landmark — the first full set most players finish and remember. Seamsteel is the ladder's anchor name, sitting where the spec's placeholder mithril did. |
| 10 | Barbsteel / Thornstag / Briarweave / Resined Moleskin | Gate 599 h, x5.2. The bramble tier: barb, thorn, briar, resin. Bramblewild is the first biome that supplies three families at once, so the row is unusually tight. |
| 11 | Marrowiron / Hoarback / Frostlace / Boiled Fustian | Gate 822 h, x6.2. Tundra: pale and cold, the first of the ladder's two cold bands. Frost and hoar are spent here so that rime and winter are still free at 18. |
| 12 | Glasscast / Shardmoth / Mirrorsilk / Quilted Ticking | Gate 1,094 h, x7.4. The Glasswaste. Sits just past Sage V at 1,008 h, so the spine's midpoint is the character ladder's last gate — everything above this is worn inside Mythic. |
| 13 | Hollowcast / Sporecrawler / Mycelweave / Silvered Buckram | Gate 1,420 h, x8.9. Fungal Hollow, damp and dark. Mycelweave is the first farm-only cloth that sounds like biology rather than weather, which is where Farming's line starts to show. |
| 14 | Vaultsteel / Cryptwyvern / Choirsilk / Lacquered Gabardine | Gate 1,806 h, x10.7. The Sunken Cathedral, and the first invented-compound band: vault, crypt, choir. Wyvern hide arrives exactly here rather than early, so it still means something. |
| 15 | Slagsteel / Firescale / Smokesilk / Riveted Kersey | Gate 2,255 h, x12.8. Obsidian Caldera. Heat again, but foundry heat rather than tier 7's open fire — slag and smoke are products, where ash and cinder were leavings. |
| 16 | Thundercast / Galeroc / Cloudsilk / Bone-lined Melton | Gate 2,774 h, x15.4. Stormcrag Peaks: thunder, gale, cloud. The lightest-sounding row on the ladder, deliberately, because it comes straight after the heaviest. |
| 17 | Palesteel / Fenbasilisk / Blightweave / Wire-stitched Drill | Gate 3,367 h, x18.5. Blightfen. Pale, fen, blight — the row where the world stops being merely hostile and starts being wrong, without a single loud word in it. |
| 18 | Coldcast / Rimehorn / Winterweave / Glazed Oilskin | Gate 4,038 h, x22.2. The Rimeworks: cold that was manufactured. Second cold band, and every word differs from tier 11's so the two never blur. |
| 19 | Nightiron / Sablewyrm / Hushweave / Varnished Sateen | Gate 4,793 h, x26.6. The hush before the Voidscar, and the last tier with an ordinary source — night, sable, hush. Quiet on purpose, so tier 20 can turn. |
| 20 | Barrowsteel / Gravemaw / Shroudsilk / Plate-backed Damask | Gate 5,637 h, x31.9. Where the mythic band opens, and it opens on grave goods rather than gods: barrow, grave, shroud. Concrete nouns doing mythic work. |
| 21 | Voidcast / Scarborn / Nullweave / Hollow-plied Brocade | Gate 6,575 h, x38.3. Voidscar. Scarborn hide is what the Scarborn Recurve and Scattergun are actually made of, so two uniques finally have a stated source. |
| 22 | Cometiron / Starcoil / Meteorsilk / Cold-pressed Grosgrain | Gate 7,612 h, x46.0. What fell out of the sky: comet, star, meteor — three words for one idea, none of them repeated. Meteoric iron is real, which keeps the row from floating off. |
| 23 | Solsteel / Pyrewing / Sunlace / Glass-set Sarcenet | Gate 8,752 h, x55.2. Sunspire's light. Sol rather than sun in the metal column so the cloth can have Sunlace — same idea, different word, per the row rule. |
| 24 | Firstlight Steel / Dawnmane / Morrowsilk / Ninefold Poplin | Gate 10,000 h, x66.2. First light: firstlight, dawn, morrow. The arc lands here — tier 24 and Mythic V on the same focused hour — and the top name is a two-word steel, not a fanfare. |

### 16.2 The 24 weapon archetypes

**Convention.** NAMING. An archetype is exactly one word, STEM + HEAD, no spaces, no apostrophes, no adjectives (adjectives belong to material and quality, which wrap around it). STEM names the ROLE and is shared across all four styles, so the role reads before the style does: Snap- fast and shallow, Fell- slow and final, Far- reach, Hail- volley, Thread- precise, Ward- one-handed. One stated exception a generator can encode: melee's role-4 stem is Sweep-, not Hail-, because a melee multi-hit is an arc rather than a volley. HEAD names the STYLE, drawn from that style's closed head set: melee takes edged and hafted heads (edge, maul, pike, lash, spike), ranged takes draw-and-release heads (bow, winch, loft, cord, sling), magic takes held-focus heads (rod, stave, glass, sigil, lens, knot), gun takes mechanism heads (lock, bore, piece, shot, sight, grip). A head may repeat inside a style: melee's two one-h

```
"{material} {archetype}" where archetype = STEM[role] + HEAD[style][role] | style = ["melee","ranged","magic","gun"][floor((index-1)/6)] | role = ((index-1) mod 6) + 1 | STEM = ["Snap","Fell","Far","Hail","Thread","Ward"], with STEM[4] = "Sweep" when style == "melee" | HEAD.melee = ["edge","maul","pike","lash","spike","edge"], HEAD.ranged = ["bow","winch","loft","cord","bow","sling"], HEAD.magic =
```

| # | Archetype | Role |
|---|---|---|
| 1 | Snapedge | Melee role 1 — fast and shallow: two hits an exchange at D 0.38, band +/-19%, one-handed so the offhand stays free, and melee pays no ammo, which makes it the cheapest weapon in the game to swing. |
| 2 | Fellmaul | Melee role 2 — slow and final: one hit at D 0.95, two-handed, band +/-14%; the biggest thing melee can land in a single exchange. |
| 3 | Farpike | Melee role 3 — reach: D 0.77 after paying 15% of its budget for one free opening hit that costs no durability, which is how a melee loadout survives an over-tier spawn. |
| 4 | Sweeplash | Melee role 4 — multi-hit arc: three hits at D 0.32 and the widest band in the catalogue (+/-24%), so its rolls swing hardest, and the only role-4 weapon with no ammo bill at all. |
| 5 | Threadspike | Melee role 5 — high crit, narrow band: 35% crit on one hit at D 0.74 inside +/-8%, the tightest numbers any weapon shows. |
| 6 | Wardedge | Melee role 6 — one-handed and guarded: D 0.59, spending 35% of its offence budget on the free offhand slot and its own defence. |
| 7 | Snapbow | Ranged role 1 — light draw: two arrows an exchange at D 0.38 and two arrows of upkeep, cheap on the ammo ladder, one-handed. |
| 8 | Fellwinch | Ranged role 2 — cranked and slow: one bolt at D 0.95 for one unit of ammo, the heaviest hit the hide line can buy at any tier. |
| 9 | Farloft | Ranged role 3 — lobbed reach: D 0.77 plus the free opening shot, the standing answer to anything that has to close the distance. |
| 10 | Hailcord | Ranged role 4 — volley: three arrows at D 0.32 and three arrows of upkeep an attack, wide band +/-24%; affordable only because arrows sit low on the cost ladder. |
| 11 | Threadbow | Ranged role 5 — one aimed shot: 35% crit at D 0.74, band +/-8%, the best crit per unit of ammo in the game. |
| 12 | Wardsling | Ranged role 6 — one-handed sling: D 0.59 with the offhand free, the only ranged weapon that can carry a ward alongside it. |
| 13 | Snaprod | Magic role 1 — two quick bolts at D 0.38, one-handed; two runes an attack is where medium ammo cost first bites. |
| 14 | Fellstave | Magic role 2 — one slow heavy cast: D 0.95 for a single rune, the cheapest way to spend runes and the robes line's ceiling. |
| 15 | Farglass | Magic role 3 — struck through a lens at distance: D 0.77 plus the free opening cast. |
| 16 | Hailsigil | Magic role 4 — scattered bolts: three casts at D 0.32, three runes an attack and band +/-24%, expensive enough that Runecrafting becomes the limiting skill. |
| 17 | Threadlens | Magic role 5 — 35% crit on one cast at D 0.74 inside +/-8%, one rune spent per attempt. |
| 18 | Wardknot | Magic role 6 — one-handed charm: D 0.59 with the offhand free, the robes line's only offhand-compatible weapon. |
| 19 | Snaplock | Gun role 1 — two light shots at D 0.38, one-handed; the cheapest gun to run and still two cartridges an attack, and the first firearm available at tier 6. |
| 20 | Fellbore | Gun role 2 — one shot at D 0.95, the highest single hit in the catalogue, sitting at the top of the upkeep ladder as the cost curve intends. |
| 21 | Farpiece | Gun role 3 — longest reach of any weapon: D 0.77 plus the free opening shot for one cartridge. |
| 22 | Hailshot | Gun role 4 — spread: three pellets at D 0.32, three cartridges an attack and band +/-24%, which makes it the most expensive weapon in the game to fire. |
| 23 | Threadsight | Gun role 5 — 35% crit at D 0.74, band +/-8%, one cartridge; the gun line's cheapest route into an over-tier spawn. |
| 24 | Wardgrip | Gun role 6 — one-handed sidearm: D 0.59 with the offhand free, and like every gun it exists only across tiers 6-18. |

### 16.3 The 20 biome prefixes and their materials

**Convention.** HOW A VARIANT IS NAMED. A monster's name is exactly two parts: the biome's prefix, then the species archetype's own name. "{prefix} {species}". Nothing else is ever appended — no suffix, no "of the", no possessive, no second adjective. The species carries behaviour, kill-time, style and parts; the prefix carries tier, biome and flavour. One archetype in six biomes is six names and six fights, from one design. RULE 1 — ONE WORD, TWO MORPHOLOGIES. Every prefix is a single unhyphenated word in one of only two shapes: (a) a plain adjective of the biome's dominant condition — Tidal, Ashen, Brackish, Unmade; or (b) a closed compound of biome-substance + biome-condition — Hushwood, Deadlamp, Wrackshore, Coldwrought. There is no third shape. No apostrophes anywhere in the catalogue; no stacked adjectives; nothing longer than four syllables. RULE 2 — CONDITION, NOT ADDRESS. The prefix names the s

```
"{biome.prefix} {species.name}" — e.g. biome 11 + wolf → "Rime Wolf"; biome 7 + wolf → "Ashen Wolf". Collision branch: if species.stem is set and species.stem == biome.stem, emit "{biome.understudy} {species.name}" → "Hoarfrost Rime Elemental", "Rockpool Tide Elemental", "Hollowdamp Sporeling". Materials: "{biome.materials.mineral}" / "{biome.materials.organic}" / "{biome.materials.essence}", alwa
```

| # | Prefix | Tiers, and the three biome materials |
|---|---|---|
| 1 | Hedgerow | Tiers 1–2, arriving ~0 h. The first prefix, and the only pastoral one: things that live in the field margin rather than the field. Materials: Meadow Chalk (mineral), Sunwort Sprig (organic), Clover Pollen (essence). |
| 2 | Hushwood | Tiers 2–4, ~3 h. Takes the quiet from Whispering Wood rather than the trees, so it does not collide with Rootdeep's timber register two biomes later. Materials: Loamstone Chip, Hushbark Strip, Whisper Resin. |
| 3 | Tidal | Tiers 3–5, ~10 h. Fixed by the spec's own Tidal Wolf Pelt. First of the four plain adjectives, and deliberately the plainest — a shallow, sunlit, low-stakes water. Materials: Reefchalk, Bladderweed Frond, Tidefoam. Understudy: Rockpool, for the tide elemental. |
| 4 | Rootbound | Tiers 4–6, ~27 h. Where Hushwood was a condition of air, this is a condition of being held: the thicket has grown through the animal. Materials: Rootflint, Deadfall Fibre, Thicket Musk. |
| 5 | Deadlamp | Tiers 5–7, ~56 h. The first man-made prefix in the ladder and the first genuinely unwelcoming one — a mine whose lamps went out, not a mine that is dark. Materials: Tailings Grit, Pitprop Splinter, Lampsoot. |
| 6 | Brackish | Tiers 6–8, ~103 h. Closes the low band by souring Tidepool's clean water: same element, three tiers meaner. Materials: Brack Salt, Reed Cord, Marshgas Bladder. |
| 7 | Ashen | Tiers 7–9, ~171 h. Fixed by the spec's Ashen Wolf. Opens the burnt band and sits on the gun gate, so it is the prefix a player remembers as the point the game changed shape. Materials: Ridge Sulphur, Scorchbark Char, Cinderglass Flake. |
| 8 | Wrackshore | Tiers 8–10, ~266 h. The third and last coastal prefix, and the drowned one: Tidal is a pool, Brackish is a marsh, this is what the sea gave back. Materials: Shell Grit, Wrackweed Coil, Saltbloom. |
| 9 | Deepvein | Tiers 9–11, ~393 h. Answers Deadlamp four biomes on — the mine that was abandoned versus the seam still worth following. Materials: Seamcoal, Blindmoss Mat, Firedamp Flask. |
| 10 | Briar | Tiers 10–12, ~556 h. A synonym for the biome rather than the biome's word, which is the pattern for every prefix: Bramblewild yields Briar, and no name says bramble twice. Materials: Briarflint, Thornvine Cord, Bramble Honey. |
| 11 | Rime | Tiers 11–13, ~762 h. Fixed by the spec: a Rime Wolf drops Wolf Pelt and Rime Salt. The shortest prefix in the twenty, and the cold that is weather — biome 18 is the cold that is machinery. Materials: Rime Salt, Frostfur Tuft, Blue Ice Core. Understudy: Hoarfrost, for the rime elemental. |
| 12 | Glasscut | Tiers 12–14, ~1,015 h. The midpoint of the material spine and the Sage V crossing; the first prefix that describes an injury rather than a coating. Materials: Fulgur Sand, Sunbleached Sinew, Mirrorshard. |
| 13 | Sporelit | Tiers 13–15, ~1,322 h. Opens the consecrated-and-rotting band: the fungus is not on the animal, it is lighting it from inside. Materials: Damp Chalk, Mycelium Mat, Spore Amber. Understudy: Hollowdamp, for the sporeling family. |
| 14 | Sanctum | Tiers 14–16, ~1,689 h. The only ecclesiastical prefix, spent on the cipher biome so the vocabulary shift marks the gate. Reads as consecrated rather than holy, which is what a flooded cathedral full of revenants should sound like. Materials: Votive Lead, Vestment Scrap, Choir Ash. |
| 15 | Emberglass | Tiers 15–17, ~2,120 h. Deliberately compounds Ashen's fire with Glasscut's edge eight biomes on — the caldera is both, hotter, and the compound says so without a second adjective. Materials: Caldera Obsidian, Blistered Hide, Emberglass Bead. |
| 16 | Stormworn | Tiers 16–18, ~2,624 h. Weathered, not struck: the peaks have sanded these things down over years. The last prefix that is merely natural. Materials: Cragslate, Windfeather Quill, Thunderglass. |
| 17 | Fenrot | Tiers 17–19, ~3,205 h. Takes Blightfen's second half so it does not repeat blight, and pairs against Brackish eleven biomes below: same standing water, eleven tiers of decay later. Materials: Bogiron Nodule, Rotweed Bundle, Miasma Flask. |
| 18 | Coldwrought | Tiers 19–21, ~4,626 h. Where the floor formula jumps a tier and the world stops being weather. Rime is frost that fell; this is frost that was manufactured, which is the whole difference between biome 11 and the Rimeworks. Materials: Enginesteel Scrap, Gasket Leather, Null Coolant. |
| 19 | Unmade | Tiers 21–23, ~6,436 h. The shortest possible statement and the last plain adjective — after eighteen biomes of substances, a prefix that names an absence. Gates Sunspire. Materials: Scarstone, Unmade Marrow, Hollow Ichor. |
| 20 | Spirelit | Tiers 23–24, ~8,690 h to enter; its ceiling tier is the 10,000-hour shelf, so this is the prefix worn by everything a Mythic V character fights. Closes the ladder by returning to light, the register biome 1 opened with, and lit from above rather than from within like Sporelit. Materials: Spirestone, Lightburnt Hide, Firstlight. |

### 16.4 Consumables, refined goods and seeds

**Conventions and the price curve.**

```
— 0. The one curve everything prices off

`V(T) = round(10 * 1.20^(T-1))` coins — the **tier value** of one unit of tier-T material, T = 1..24.

T:V — 1:10 2:12 3:14 4:17 5:21 6:25 7:30 8:36 9:43 10:52 11:62 12:74 13:89 14:107 15:128 16:154 17:185 18:222 19:266 20:319 21:383 22:460 23:552 24:662

Every price below is a fixed **fraction or multiple of V(T)**, never a hand-typed number. That is the load-bearing choice: ratios are tier-invariant, so you never grow into or out of an ammunition cost, and the style-economy ladder of §7 holds identically at tier 3 and tier 23.

**Fuel is derived, not invented.** `fuel(session) = XP(session) / 5` → 3 / 5 / 12 for a 15 / 25 / 50-minute session (the 50 carries its +20%). The chain multiplier applies to fuel exactly as it applies to yield. Cross-check against the spec's own numbers: 10,000 focused hours = 600,000 XP = **120,000 lifetime fuel**, which is what makes §12's *"spend 100,000 fuel"* an endgame achievement (~8,300 focused hours) rather than a mid-game one. Every fuel cost below is priced against that budget.

**Nothing here references real time.** Potions are drunk at the requirement gate and last exactly one session, or a stated number of charges. Farm stages advance per *completed session*. Oils, stones and refinement attempts are per *action*. Runes and rounds are per *kill*. No consumable in this pool has a duration measured in minutes or hours, and none of them touch character XP — V1's invariant is that XP comes only from timed minutes.

**Material words are borrowed by index, never duplicated.** `metal[T]`, `hide[T]`, `cloth[T]`, `gem[g]`, `wood[k]`, `essence` belong to the material-spine pool. Every convention here consumes one of those by index and adds **exactly one noun of its own**. That is why 900-odd rows cost eight nouns to name. Illustrative fills use only safely generic low-tier metals (copper, tin, iron, steel).

— 1. The band lexicon — twelve words, used by seeds and dyes

Band k covers spine tiers 2k-1 and 2k. The words run in biome order, so a name's band is learnable rather than memorised:

k1 Meadow · k2 Hedge · k3 Tide · k4 Grove · k5 Ash · k6 Seam · k7 Rime · k8 Glass · k9 Spore · k10 Vault · k11 Null · k12 Sun

There is no thirteenth word. A pool that needs finer granularity indexes the spine directly instead.

— 2. Potions — `{Effect} {Form} {ROMAN(t)}`, 30 effects x 6 tiers = 180

- **Form is chosen by the effect's class, not by taste:** *Tonic* = gathering and production, *Draught* = offence, *Salve* = protection and upkeep, *Elixir* = economy, luck and meta. Four forms, thi
```

```
potion    = "{effect} {form} {ROMAN(t)}"                              t = 1..6;  form fixed per effect class {Tonic|Draught|Salve|Elixir}
rune      = "{runeWord[T]} Rune"                                     T = 1..24; class = ((T-1) mod 4)+1 -> strike|burst|pierce|ward
ammo      = "{metal[T]} {family}"                                    family in {Arrow, Bolt, Dart, Cartridge, Shell}; gun families T >= 6
cell      = "{runeWord[T]} Cell"                                     the sixth ammunition family, named off the rune ladder
stone     = "{metal[T]} {kind}"                                      kind = Grindstone (+1..+4) | Temperstone (+5..+7) | Keystone (+8..+10)
jewellery = "{metal[3j]} {gem[g]} {type}"                             j = 1..8, g = 1..24, type in {Ring, Signet, Amulet, Pendant}
seed      = "{band[k]}{sep}{species[line][((k-1) mod 4)+1]} {lineNoun}"   k = 1..12; sep = "" if species word is bound else " "
                                                                     lineNoun = Seed (herbs, fibre) | Sapling | Stock
refined   = "{sourceWord} {classNoun}"                               classNoun in {Bar, Plank, Charcoal, Thread, Cord, Cloth, Leather, Rune}
alloy     
```

| # | Item | What it does |
|---|---|---|
| 1 | Deep Vein Tonic | Tonic. Mining yield +5t% (5 to 30). One session, drunk at the gate. |
| 2 | Long Grain Tonic | Tonic. Woodcutting yield +5t%. Same shape as Deep Vein, different skill - the six gathering tonics are one row of the generator. |
| 3 | Full Net Tonic | Tonic. Fishing yield +5t%. |
| 4 | Green Hand Tonic | Tonic. Foraging yield +5t%. |
| 5 | Quiet Step Tonic | Tonic. Hunting yield +5t%. |
| 6 | Sifting Tonic | Tonic. Excavation yield +5t%, which for the coin skill means relics per session. |
| 7 | Second Cut Tonic | Tonic. 5t% chance each gathered unit yields twice - a proc rather than a flat rate, so it feels different from the six above. |
| 8 | Steady Hand Tonic | Tonic. Tool durability wear reduced 5t% for the session. The only tonic that saves coins instead of making materials. |
| 9 | Root Sense Tonic | Tonic. A gathering session also drops ceil(t/2) seeds of its own band - the cheap way into the Farming ladder. |
| 10 | Kiln Tonic | Tonic. The next t processing actions cost half fuel. Charges, not minutes: the only tonic that survives past the session it was drunk in. |
| 11 | Hard Swing Draught | Draught. Melee weapon power +5t%. One of four style draughts; the wheel decides which one you brewed for. |
| 12 | True Flight Draught | Draught. Ranged weapon power +5t%. |
| 13 | Clear Mind Draught | Draught. Magic weapon power +5t%. |
| 14 | Cold Barrel Draught | Draught. Firearm power +5t%. Unbuyable below potion tier II, since guns enter at spine tier 6. |
| 15 | Quick Kill Draught | Draught. Kill-time reduced 3t% - more spawns per session, so it multiplies loot rolls rather than damage. |
| 16 | Overmatch Draught | Draught. +5t points of conversion chance against over-tier spawns. The potion that buys access instead of power. |
| 17 | Cross-Guard Draught | Draught. The wrong-style penalty is reduced by 5t% of itself. Never removes it: the wheel has to keep mattering. |
| 18 | First Blood Draught | Draught. The first ceil(t/2) kills of the session are guaranteed regardless of spawn power. |
| 19 | Whole Skin Salve | Salve. The first t failed kills cost no ration. Half of the failure cost, paid off. |
| 20 | Thick Hide Salve | Salve. Durability wear reduced 5t% for the session. |
| 21 | Mending Salve | Salve. Restores 5t durability across equipped gear at the gate - the alternative to walking to the shop. |
| 22 | Cold Iron Salve | Salve. Worn items count at full power for one session. Turns a broke week into a playable one. |
| 23 | Sure Footing Salve | Salve. Conversion chance floored at 5t% - never below, which is the sliding-chance rule made explicit. |
| 24 | Held Line Salve | Salve. The first t failed kills cost no durability. The other half of the failure cost, deliberately a separate potion. |
| 25 | Coin Eye Elixir | Elixir. Coin drops +5t%. |
| 26 | Long Odds Elixir | Elixir. Rare-drop chance +5t% relative. Luck as a consumable, matching luck-on-trinkets rather than luck-on-tier. |
| 27 | Stonecutter Elixir | Elixir. +ceil(5t/2) points of refinement success for the next t attempts. The only consumable that touches the +1..+10 axis. |
| 28 | Ledger Elixir | Elixir. Skill XP +5t% for the session's chosen activity skill. Never character XP - that comes only from timed minutes. |
| 29 | Contract Elixir | Elixir. Slaying contract credit counts double for t kills. |
| 30 | Full Bloom Elixir | Elixir. The next t completed sessions advance every plot two stages. Session-driven, so it stays inside the no-clock rule. |
| 1 | Spark Rune | T1 strike. Power 6, 5 essence, 39 per craft, 3 coins each. The burn-word family marks every strike rune. |
| 2 | Grit Rune | T2 burst. Power 8, 6 essence, 38 per craft, 4 coins. Cloud words mark burst. |
| 3 | Brine Rune | T3 pierce. Power 10, 7 essence, 37 per craft, 4 coins. Point words mark pierce. |
| 4 | Bough Rune | T4 ward. Power 12, 8 essence, 36 per craft, 5 coins. Cover words mark ward, and T4 closes band 1. |
| 5 | Ember Rune | T5 strike. Power 14, 9 essence, 35 per craft, 6 coins. |
| 6 | Ash Rune | T6 burst. Power 16, 10 essence, 34 per craft, 8 coins. Named for Ashfall Ridge, where the gun line also starts. |
| 7 | Thorn Rune | T7 pierce. Power 18, 11 essence, 33 per craft, 9 coins. |
| 8 | Shell Rune | T8 ward. Power 20, 12 essence, 32 per craft, 11 coins. |
| 9 | Sear Rune | T9 strike. Power 22, 13 essence, 31 per craft, 13 coins. |
| 10 | Murk Rune | T10 burst. Power 24, 14 essence, 30 per craft, 16 coins. |
| 11 | Quill Rune | T11 pierce. Power 26, 15 essence, 29 per craft, 19 coins. |
| 12 | Rime Rune | T12 ward. Power 28, 16 essence, 28 per craft, 22 coins. Frostbite Tundra's rune, and the midpoint of the ladder. |
| 13 | Glass Rune | T13 strike. Power 30, 17 essence, 27 per craft, 27 coins. |
| 14 | Spore Rune | T14 burst. Power 32, 18 essence, 26 per craft, 32 coins. |
| 15 | Shard Rune | T15 pierce. Power 34, 19 essence, 25 per craft, 38 coins. |
| 16 | Psalm Rune | T16 ward. Power 36, 20 essence, 24 per craft, 46 coins. The Sunken Cathedral's rune. |
| 17 | Slag Rune | T17 strike. Power 38, 21 essence, 23 per craft, 56 coins. |
| 18 | Gale Rune | T18 burst. Power 40, 22 essence, 22 per craft, 67 coins. |
| 19 | Blight Rune | T19 pierce. Power 42, 23 essence, 21 per craft, 80 coins. |
| 20 | Null Rune | T20 ward. Power 44, 24 essence, 20 per craft, 96 coins. The Rimeworks rune. |
| 21 | Scar Rune | T21 strike. Power 46, 25 essence, 19 per craft, 115 coins. |
| 22 | Void Rune | T22 burst. Power 48, 26 essence, 18 per craft, 138 coins. |
| 23 | Rift Rune | T23 pierce. Power 50, 27 essence, 17 per craft, 166 coins. |
| 24 | Spire Rune | T24 ward. Power 52, 28 essence, 16 per craft, 199 coins. The capstone is a ward, and it is the one rune whose class effect cancels the wrong-style penalty outright. |
| 1 | {metal T} Arrow | Ranged, bows. famCost 0.10, famK 1.0. Prices 1 / 3 / 7 / 22 / 66 coins at T1 / 6 / 12 / 18 / 24; power 3 to 26. The cheap floor of the upkeep ladder. e.g. Copper Arrow, Steel Arrow. |
| 2 | {metal T} Bolt | Ranged, crossbows. 0.14 / 1.3. 4 / 10 / 31 / 93 coins at T6 / 12 / 18 / 24; power to 34. |
| 3 | {metal T} Dart | Ranged, thrown. 0.18 / 1.6. 5 / 13 / 40 / 119 coins; power to 42. The top of the cheap style. |
| 4 | {metal T} Cartridge | Gun, rifles and pistols. 0.80 / 2.4. 20 / 59 / 178 / 530 coins from T6 up; power to 62. Rows 1-5 exist and are unbuyable so the 6 x 24 arithmetic holds. |
| 5 | {metal T} Shell | Gun, scatter weapons. 1.00 / 2.8. 25 / 74 / 222 / 662 coins; power to 73 - a shell costs exactly one unit of tier value, which is the easiest row in the game to reason about. |
| 6 | {runeWord T} Cell | Gun, the top family - and the only ammunition named off the rune ladder rather than the metal one, because a cell is a sealed powder-and-essence round. 1.30 / 3.2. 33 / 96 / 289 / 861 coins; power to 83. e.g. Rime Cell, Null Cell, Spire Cell. |
| 1 | {metal T} Grindstone | Refinement +1 to +4. Price 1 x V(T) - 10 coins at tier 1, 662 at tier 24. Stones per attempt 1, 2, 3, 5; success 100 / 93 / 86 / 79%. The metal word means rated for that tier, not made of it. |
| 2 | {metal T} Temperstone | Refinement +5 to +7. Price 3 x V(T). Stones per attempt 7, 11, 17; success 72 / 65 / 58%. Three times the stone for the middle band is where the curve starts to bite. |
| 3 | {metal T} Keystone | Refinement +8 to +10. Price 9 x V(T). Stones per attempt 27, 43, 69; success 51 / 44 / 37%. A +10 at tier 24 runs to roughly 1.5M coins in expectation, which is the whole reason the axis needs no gamble. |
| 1 | {metal 3j} {gem} Ring | Ring slot. Channel: conversion - % to beat an over-tier spawn. Metal tiers 3, 6, 9, 12, 15, 18, 21, 24 (every third rung of the spine, which is where the eight metals come from). e.g. Copper Garnet Ring. |
| 2 | {metal 3j} {gem} Signet | Ring slot, competing with Ring. Channel: drop rate - the explicit luck modifier you trade a slot for. Same metal and gem axes. |
| 3 | {metal 3j} {gem} Amulet | Amulet slot. Channel: throughput - kill-time, so it pays in extra spawns and extra rolls rather than in power. |
| 4 | {metal 3j} {gem} Pendant | Amulet slot, competing with Amulet. Channel: gathering yield and skill XP - the only jewellery that is worth wearing on a non-combat session. |
| 1 | Meadowwort Seed | Herb line, band 1 (tiers 1-2). 3 stages, 8 units, 2 fuel to plant, 24 coins. Feeds potion tier I with Hedgeknit. |
| 2 | Hedgeknit Seed | Herb line, band 2 (tiers 3-4). 6 stages, 8 units, 4 fuel, 34 coins. Completes potion tier I. |
| 3 | Tidethistle Seed | Herb line, band 3 (tiers 5-6). 8 stages, 8 units, 6 fuel, 50 coins. Opens potion tier II. |
| 4 | Groveleaf Seed | Herb line, band 4 (tiers 7-8). 11 stages, 7 units, 8 fuel, 72 coins. |
| 5 | Ashwort Seed | Herb line, band 5 (tiers 9-10). 13 stages, 7 units, 10 fuel, 104 coins. Opens potion tier III. |
| 6 | Seamknit Seed | Herb line, band 6 (tiers 11-12). 15 stages, 7 units, 12 fuel, 148 coins. |
| 7 | Rimethistle Seed | Herb line, band 7 (tiers 13-14). 18 stages, 6 units, 14 fuel, 214 coins. Opens potion tier IV. |
| 8 | Glassleaf Seed | Herb line, band 8 (tiers 15-16). 20 stages, 6 units, 16 fuel, 308 coins. |
| 9 | Sporewort Seed | Herb line, band 9 (tiers 17-18). 23 stages, 6 units, 18 fuel, 444 coins. Opens potion tier V. |
| 10 | Vaultknit Seed | Herb line, band 10 (tiers 19-20). 25 stages, 5 units, 20 fuel, 638 coins. |
| 11 | Nullthistle Seed | Herb line, band 11 (tiers 21-22). 28 stages, 5 units, 22 fuel, 920 coins. Opens potion tier VI. |
| 12 | Sunleaf Seed | Herb line, band 12 (tiers 23-24). 30 stages, 5 units, 24 fuel, 1,324 coins. The longest crop in the game and the last ingredient of a tier-VI potion. |
| 1 | Meadowflax Seed | Fibre line, band 1, stalk fibre. 3 stages, 8 units. Foraging can also supply this band; above band 4 it cannot. |
| 2 | Hedgehemp Seed | Fibre line, band 2, stalk fibre. 6 stages, 8 units. |
| 3 | Tidecotton Seed | Fibre line, band 3, boll fibre. 8 stages, 8 units. |
| 4 | Grovemulberry Seed | Fibre line, band 4, leaf crop for silk. 11 stages, 7 units. The last band the wild can supply - cloth above tier 8 is farm-only. |
| 5 | Ashflax Seed | Fibre line, band 5, stalk. 13 stages, 7 units. First farm-only band, and where Magic's armour line becomes a Farming project. |
| 6 | Seamhemp Seed | Fibre line, band 6, stalk. 15 stages, 7 units. |
| 7 | Rimecotton Seed | Fibre line, band 7, boll. 18 stages, 6 units. |
| 8 | Glassmulberry Seed | Fibre line, band 8, leaf for silk. 20 stages, 6 units. |
| 9 | Sporeflax Seed | Fibre line, band 9, stalk. 23 stages, 6 units. |
| 10 | Vaulthemp Seed | Fibre line, band 10, stalk. 25 stages, 5 units. |
| 11 | Nullcotton Seed | Fibre line, band 11, boll. 28 stages, 5 units. |
| 12 | Sunmulberry Seed | Fibre line, band 12, leaf for silk. 30 stages, 5 units. Top of the cloth ladder, and four plots is what decides how much of it you can run at once. |
| 1 | Meadow Oak Sapling | Sapling line, band 1. 3 stages, 8 units. Yields wood one tier above the wild cut of the same band. |
| 2 | Hedge Pine Sapling | Sapling line, band 2. 6 stages, 8 units. |
| 3 | Tide Elm Sapling | Sapling line, band 3. 8 stages, 8 units. |
| 4 | Grove Birch Sapling | Sapling line, band 4. 11 stages, 7 units. |
| 5 | Ash Oak Sapling | Sapling line, band 5. 13 stages, 7 units. Wild wood stops here: bands 6-12 planks are sapling-only. |
| 6 | Seam Pine Sapling | Sapling line, band 6. 15 stages, 7 units. First plank band with no wild source at all. |
| 7 | Rime Elm Sapling | Sapling line, band 7. 18 stages, 6 units. |
| 8 | Glass Birch Sapling | Sapling line, band 8. 20 stages, 6 units. |
| 9 | Spore Oak Sapling | Sapling line, band 9. 23 stages, 6 units. |
| 10 | Vault Pine Sapling | Sapling line, band 10. 25 stages, 5 units. |
| 11 | Null Elm Sapling | Sapling line, band 11. 28 stages, 5 units. |
| 12 | Sun Birch Sapling | Sapling line, band 12. 30 stages, 5 units. The only source of tier-24 planks, so the top of the bow and staff lines runs through a plot. |
| 1 | Meadow Hare Stock | Livestock line, band 1. 3 stages, 8 units. Hide tier guaranteed at 2, where Hunting rolls. |
| 2 | Hedge Goat Stock | Livestock line, band 2. 6 stages, 8 units. Hide tier 4 guaranteed. |
| 3 | Tide Boar Stock | Livestock line, band 3. 8 stages, 8 units. Hide tier 6. |
| 4 | Grove Elk Stock | Livestock line, band 4. 11 stages, 7 units. Hide tier 8. |
| 5 | Ash Hare Stock | Livestock line, band 5. 13 stages, 7 units. Hide tier 10. |
| 6 | Seam Goat Stock | Livestock line, band 6. 15 stages, 7 units. Hide tier 12. |
| 7 | Rime Boar Stock | Livestock line, band 7. 18 stages, 6 units. Hide tier 14. |
| 8 | Glass Elk Stock | Livestock line, band 8. 20 stages, 6 units. Hide tier 16. |
| 9 | Spore Hare Stock | Livestock line, band 9. 23 stages, 6 units. Hide tier 18. |
| 10 | Vault Goat Stock | Livestock line, band 10. 25 stages, 5 units. Hide tier 20. |
| 11 | Null Boar Stock | Livestock line, band 11. 28 stages, 5 units. Hide tier 22. |
| 12 | Sun Elk Stock | Livestock line, band 12. 30 stages, 5 units. Hide tier 24 guaranteed - the difference between a hide roll and a hide certainty at the top of the ranged line. |
| 1 | {metal T} Bar | Refined, 24 rows. Smelting: ore of tier T plus charcoal of band >= ceil(T/2). e.g. Copper Bar, Tin Bar, Iron Bar, Steel Bar. Sells at 2 x V(T). |
| 2 | {metal 2k-1}-{metal 2k} Ingot | Refined alloys, 12 rows. A hyphen-pair names the alloy by what went into it, so no new material word is coined and the recipe is legible from the name. e.g. Copper-Tin Ingot at band 1. Tier = 2k; feeds the composite coat line. |
| 3 | Meadow Oak Plank | Refined, 12 rows: {wood k} Plank. Fletching input for bows, staves and arrow shafts. Bands 6-12 are sapling-only. |
| 4 | Meadow Oak Charcoal | Refined, 12 rows: {wood k} Charcoal. Firemaking. Smelting a tier-T bar demands band >= ceil(T/2), which is what keeps Woodcutting in the metal chain forever. |
| 5 | Meadowflax Thread | Refined, 12 rows: {fibre k} Thread. Tailoring's first step, spun from the farm crop of the same band. |
| 6 | Meadowflax Cord | Refined, 12 rows: {fibre k} Cord. Bowstrings. The second noun the fibre lexicon carries, and the reason the fibre line serves both Magic and Ranged. |
| 7 | {cloth T} Cloth | Refined, 24 rows. Woven from thread of band ceil(T/2) plus one dye above band 4. Inherits the spine's cloth word untouched. |
| 8 | {hide T} Leather | Refined, 24 rows. Tanned from the spine hide of the same tier with one Proofing Oil. Inherits the spine's hide word untouched. |
| 1 | Coarse Powder | Gunpowder, tiers 6-11. 3 saltpetre + 1 sulphur + 1 charcoal (band >= 3). powderPerRound = ceil(T/6), so one row of powder serves a whole band of cartridges. |
| 2 | Milled Powder | Gunpowder, tiers 12-17. Same recipe shape, charcoal band >= 4. The grade must be at or above the round's band, which is the only gate the gun chain needs. |
| 3 | Glazed Powder | Gunpowder, tiers 18-24. Charcoal band >= 5. Carries shells and cells at the top of the ladder, where upkeep is the point. |
| 1 | Meadow Green Dye | Dye, band 1. No stat, ever: one dye per garment above cloth band 4 and per coat, and it sets the displayed colour. The only free axis in the catalogue. |
| 2 | Hedge Umber Dye | Dye, band 2. |
| 3 | Tide Blue Dye | Dye, band 3. |
| 4 | Grove Ochre Dye | Dye, band 4. |
| 5 | Ash Red Dye | Dye, band 5. |
| 6 | Seam Grey Dye | Dye, band 6. |
| 7 | Rime White Dye | Dye, band 7. |
| 8 | Glass Clear Dye | Dye, band 8. Reads as an absence rather than a colour, which is the point at which the ladder stops being pastoral. |
| 9 | Spore Violet Dye | Dye, band 9. |
| 10 | Vault Gold Dye | Dye, band 10. |
| 11 | Null Black Dye | Dye, band 11. |
| 12 | Sun Amber Dye | Dye, band 12. The endgame colour, and the only one a Sunspire coat can take. |
| 1 | Fish Whetting Oil | Oil, source band 1 (tiers 1-6), use: tool and weapon wear reduced 20% for one session. |
| 2 | Fish Proofing Oil | Oil, band 1, use: hide and coat wear reduced 20%. Also the tanning input for {hide T} Leather. |
| 3 | Fish Quenching Oil | Oil, band 1, use: +2 points of refinement success for the next 1 attempt. |
| 4 | Seed Whetting Oil | Oil, band 2 (tiers 7-12). Wear reduced 40%. |
| 5 | Seed Proofing Oil | Oil, band 2. Hide and coat wear reduced 40%. |
| 6 | Seed Quenching Oil | Oil, band 2. +4 refinement success for the next 2 attempts. |
| 7 | Marrow Whetting Oil | Oil, band 3 (tiers 13-18). Wear reduced 60%. Pressed from Hunting's bone, so the oil ladder crosses from Fishing to Hunting halfway up. |
| 8 | Marrow Proofing Oil | Oil, band 3. Hide and coat wear reduced 60%. |
| 9 | Marrow Quenching Oil | Oil, band 3. +6 refinement success for the next 3 attempts. |
| 10 | Resin Whetting Oil | Oil, band 4 (tiers 19-24). Wear reduced 80%. |
| 11 | Resin Proofing Oil | Oil, band 4. Hide and coat wear reduced 80%. |
| 12 | Resin Quenching Oil | Oil, band 4. +8 refinement success for the next 4 attempts - the consumable that makes a Keystone attempt worth making. |
