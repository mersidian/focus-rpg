import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Rows, Empty, Gauge, DepthRange } from "@/components/GameUi";
import { MAX_TIER } from "@/lib/game/tiers";
import { overview } from "@/lib/game-view-service";
import { loadSkills } from "@/lib/activity-service";
import { BIOMES, BIOME_BY_INDEX } from "@/lib/game/biomes";
import {
  BIOME_TRINKET,
  contractAreas,
  contractDepth,
  contractPurse,
  trinketMarker,
} from "@/lib/game/contracts";
import { MAX_SKILL_LEVEL } from "@/lib/game/skills";
import { describeEffect } from "@/lib/game/effects";
import { groupNumber } from "@/lib/format";
import { DropContractButton, TakeContractButton } from "@/components/GameActions";

export const dynamic = "force-dynamic";

/** The Slaying level at which the ladder next reaches a deeper biome. */
function nextDepthAt(level: number): number | null {
  const now = contractDepth(level);
  for (let l = level + 1; l <= MAX_SKILL_LEVEL; l++) {
    if (contractDepth(l) > now) return l;
  }
  return null;
}

export default async function SlayingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  // One wave. This awaited the character's level first and then the skills
  // that needed it — to learn which skills are open, about a skill that is open
  // from the first minute.
  const [skills, o] = await Promise.all([loadSkills(session.user.id), overview(session.user.id)]);
  const level = skills.slaying ?? 1;

  /*
   * By biome index, which is how `rollContract` draws. This filtered on
   * `tierLo` instead, so the table promised biomes the ladder could not yet
   * name and the heading counted them.
   */
  const depth = contractDepth(level);
  const reach = BIOMES.filter((b) => b.index <= depth);
  const deeper = nextDepthAt(level);
  const claimed = new Set(o.markers);

  const c = o.contract;
  const purse = c ? contractPurse(c.tier, c.required) : null;
  const biome = c ? BIOME_BY_INDEX.get(c.biome) : null;
  const areas = c ? contractAreas(c.variantName, c.biome) : [];
  const trinket = c && !claimed.has(trinketMarker(c.biome)) ? BIOME_TRINKET.get(c.biome) : null;

  return (
    <Screen title="Slaying" lead="One target at a time, and no deadline.">
      <Block title="Your contract" aside={`Slaying ${level}`}>
        {c === null || purse === null ? (
          <>
            <Empty>
              None taken. A contract names a monster and where it lives, and pays coins, upgrade
              stones and Slaying XP when the last one falls.
            </Empty>
            <div className="mt-4">
              <TakeContractButton />
            </div>
          </>
        ) : (
          <div className="mt-4 text-body">
            {/* A contract is a ratio with a name on it, which is what a gauge is. */}
            <Gauge label={c.variantName} value={c.killed} cap={c.required} />
            {/*
              Where, and for what. The row has always stored the biome and no
              screen read it, and the purse did not exist: a contract was a
              name and a counter, and finishing it paid XP into a skill nobody
              was shown.
            */}
            <p className="mt-4 max-w-2xl leading-relaxed text-dim">
              Found in{" "}
              <Link
                href={`/game/areas?b=${c.biome}`}
                className="underline underline-offset-2"
                style={{ color: "var(--tier)" }}
              >
                {biome?.name}
                {areas.length > 0 &&
                  (areas.length === 1
                    ? `, area ${areas[0]}`
                    : `, areas ${areas[0]}–${areas[areas.length - 1]}`)}
              </Link>
              . Pays <span className="tnum text-text">{groupNumber(purse.coins)}</span> coins,{" "}
              <span className="tnum text-text">{purse.stones}</span> upgrade{" "}
              {purse.stones === 1 ? "stone" : "stones"} and{" "}
              <span className="tnum text-text">{groupNumber(purse.xp)}</span> Slaying XP
              {trinket ? (
                <>
                  {" "}
                  — and, as your first in {biome?.name},{" "}
                  <span style={{ color: "var(--tier)" }}>{trinket.name}</span>.
                </>
              ) : (
                "."
              )}
            </p>
            <p className="mt-3 text-note text-faint">
              <DropContractButton /> costs nothing, and the next one is a different target.
            </p>
          </div>
        )}
      </Block>

      <Block title="Where contracts send you" aside={`${reach.length} of ${BIOMES.length} biomes`}>
        <Rows
          head={["Biome", "Tiers", "First contract gives"]}
          rows={reach.map((b) => {
            const prize = BIOME_TRINKET.get(b.index);
            const got = claimed.has(trinketMarker(b.index));
            return [
              b.name,
              <DepthRange key="t" lo={b.tierLo} hi={b.tierHi} steps={MAX_TIER} />,
              prize ? (
                <span key="p" className="font-sans normal-nums">
                  <span style={got ? undefined : { color: "var(--tier)" }}>{prize.name}</span>
                  <span className="text-faint">
                    {got ? " · yours" : ` · ${describeEffect(prize.effect)}`}
                  </span>
                </span>
              ) : (
                "—"
              ),
            ];
          })}
        />
        <p className="mt-4 text-body leading-relaxed text-faint">
          {deeper === null ? (
            <>The ladder reaches every biome.</>
          ) : (
            <>
              Slaying <span className="tnum text-dim">{deeper}</span> adds the next biome. Kills
              and finished contracts both raise it.
            </>
          )}
        </p>
      </Block>
    </Screen>
  );
}
