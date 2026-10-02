import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Empty, SlotBoard } from "@/components/GameUi";
import { SpareGear } from "@/components/SpareGear";
import { instances } from "@/lib/game-view-service";
import { loadEquipped } from "@/lib/activity-service";
import {
  emptySlots,
  gateTier,
  loadoutPower,
  SLOTS,
  MAX_REFINE,
  type Slot,
} from "@/lib/game/power";
import { ARCHETYPES, BEATS, type Style } from "@/lib/game/archetypes";
import { SLOT_NOUN } from "@/lib/game/items";
import { refineStoneCost } from "@/lib/game/economy";
import { groupNumber } from "@/lib/format";
import { RefineButton, RepairButton, UnequipButton } from "@/components/GameActions";

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const [owned, equipped] = await Promise.all([
    instances(session.user.id),
    loadEquipped(session.user.id),
  ]);
  const power = loadoutPower(equipped);
  const style = equipped.weapon?.spec.style ?? null;
  const worn = owned.filter((i) => i.equippedSlot);
  const bySlot = new Map(worn.map((i) => [i.equippedSlot as string, i]));
  const missing = emptySlots(equipped);
  const twoHanded = equipped.weapon?.spec.archetype?.hands === 2;
  const hits = equipped.weapon?.spec.archetype?.hits ?? 1;
  const spare = owned.filter((i) => !i.equippedSlot);
  /*
   * What to search the bench for to fill a slot: the noun this style's piece
   * is called, or for a weapon the first one-handed archetype of the style.
   */
  const build: Style = style ?? (worn[0]?.style as Style | undefined) ?? "melee";
  const noun = (slot: string) =>
    slot === "weapon"
      ? (ARCHETYPES.find((a) => a.style === build && a.hands === 1)?.name ?? "")
      : (SLOT_NOUN[build][slot as Slot] ?? slot);

  return (
    <Screen
      title="Equipment"
      lead="What you wear decides what you can fight. Refining takes a piece to +10, and nothing you own is ever destroyed."
    >
      <Block
        title="Worn"
        aside={style ? `fighting as ${style}, strong against ${BEATS[style]}` : "unarmed"}
      >
        <SlotBoard
          slots={SLOTS.map((slot) => {
            const item = bySlot.get(slot);
            return {
              slot,
              tier: item?.tier ?? 0,
              name: item?.name,
              style: item?.style,
              refine: item?.refine,
              held: slot === "offhand" && twoHanded,
            };
          })}
          detail={(s) => {
            const item = bySlot.get(s.slot);
            if (!item) return null;
            return (
              <>
                {/* Where the roll landed in its own band, and how worn it is —
                    said in words, because "50%" and "100%" side by side in a
                    table were two unlabelled percentages. */}
                rolled <span className="tnum text-dim">{Math.round(item.percentile * 100)}%</span>
                {item.durability <= 0 ? (
                  <span style={{ color: "var(--color-warn)" }}>, worn out</span>
                ) : (
                  item.durability < 100 && (
                    <>
                      , <span className="tnum">{item.durability}%</span> sound
                    </>
                  )
                )}
              </>
            );
          }}
          empty={(s) => (
            // Straight to the recipe that fills it, in the style already worn.
            <Link href={`/game/crafting?q=${encodeURIComponent(noun(s.slot))}`} className="btn-quiet">
              Make one
            </Link>
          )}
          actions={(s) => {
            const item = bySlot.get(s.slot);
            if (!item) return null;
            return (
              <>
                {item.refine < MAX_REFINE && (
                  <RefineButton instanceId={item.id} step={item.refine + 1} />
                )}
                <UnequipButton slot={s.slot} />
              </>
            );
          }}
        />
        <p className="mt-5 max-w-[62ch] text-body text-faint">
          Offence <span className="tnum text-dim">{groupNumber(Math.round(power.offence))}</span>
          {hits > 1 && <>, with every one of your weapon&apos;s {hits === 2 ? "two" : "three"} hits an exchange counted</>} ·
          defence <span className="tnum text-dim">{groupNumber(Math.round(power.defence))}</span>.{" "}
          {missing.length > 0 ? (
            <>
              Areas read your shallowest slot, and{" "}
              <span style={{ color: "var(--color-warn)" }}>{missing.join(", ")}</span>{" "}
              {missing.length === 1 ? "is" : "are"} empty — so the set counts as tier 0.
            </>
          ) : (
            <>
              Areas read your shallowest slot:{" "}
              <span className="tnum text-dim">tier {gateTier(equipped)}</span>.
            </>
          )}{" "}
          Worn-out gear works at half strength until it is mended, and gear cannot be changed
          while a session is running.
        </p>
        <div className="mt-4">
          <RepairButton />
        </div>
      </Block>

      {/*
        `instances` comes back ordered by tier descending, so a truncated view
        keeps the pieces worth looking at. The heading says so, because
        "showing 60 of 340" otherwise invites the question of which sixty.
      */}
      <Block title="In the bank" aside={`${spare.length} pieces, highest tier first`}>
        {spare.length === 0 ? (
          <Empty>No spare gear. Kills drop it, and the bench makes it.</Empty>
        ) : (
          <SpareGear spare={spare} />
        )}
      </Block>

      {/*
        One sentence and a link. This block carried the whole cost table priced
        "at tier 12" — reference material, for a tier the reader was not at —
        under a paragraph beginning "Failure costs the stones and the coins",
        beside a heading reading "never fails". It never fails.
      */}
      <Block title="Refining" aside={`up to +${MAX_REFINE}`}>
        <p className="mt-3 max-w-2xl text-body leading-relaxed text-faint">
          Each step costs upgrade stones of the piece&apos;s own tier and coins, and always works.
          The first step takes <span className="tnum text-dim">{refineStoneCost(1)}</span> stone
          and the last <span className="tnum text-dim">{refineStoneCost(MAX_REFINE)}</span>. Stones
          come from salvage, contracts and Jewelcrafting.{" "}
          <Link href="/wiki/game?s=sinks" className="text-dim underline underline-offset-2">
            The full cost table
          </Link>
          .
        </p>
      </Block>
    </Screen>
  );
}
