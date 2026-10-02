import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Rows, Empty } from "@/components/GameUi";
import { SpareGear } from "@/components/SpareGear";
import { instances } from "@/lib/game-view-service";
import { loadEquipped } from "@/lib/activity-service";
import { emptySlots, gateTier, loadoutPower, SLOTS, MAX_REFINE } from "@/lib/game/power";
import { BEATS } from "@/lib/game/archetypes";
import { refineStoneCost } from "@/lib/game/economy";
import { groupNumber } from "@/lib/format";
import { RefineButton, RepairButton, UnequipButton } from "@/components/GameActions";
import { GearMark } from "@/components/GearMark";

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
  const missing = emptySlots(equipped);
  const twoHanded = equipped.weapon?.spec.archetype?.hands === 2;
  const spare = owned.filter((i) => !i.equippedSlot);

  return (
    <Screen
      title="Equipment"
      lead="What you wear decides what you can fight. Refining takes a piece to +10, and nothing you own is ever destroyed."
    >
      <Block title="Worn" aside={style ? `${style} · strong against ${BEATS[style]}` : "no style"}>
        <Rows
          head={["Slot", "Item", "Roll", "Durability", ""]}
          rows={SLOTS.map((slot) => {
            const item = worn.find((i) => i.equippedSlot === slot);
            if (!item) {
              return [
                slot,
                <span key="e" className="text-faint">
                  {slot === "offhand" && twoHanded ? "held by your two-handed weapon" : "empty"}
                </span>,
                "—",
                "—",
                "",
              ];
            }
            return [
              slot,
              <span key="n" className="inline-flex items-baseline gap-2 text-dim">
                <GearMark slot={slot} style={item.style} />
                {item.name}
                {item.refine > 0 && (
                  <span style={{ color: "var(--tier)" }}> +{item.refine}</span>
                )}
              </span>,
              `${Math.round(item.percentile * 100)}%`,
              item.durability <= 0 ? "Worn" : `${item.durability}%`,
              <span key="a" className="inline-flex flex-wrap gap-x-3">
                <UnequipButton slot={slot} />
                {item.refine < MAX_REFINE && (
                  <RefineButton instanceId={item.id} step={item.refine + 1} />
                )}
              </span>,
            ];
          })}
        />
        <p className="mt-4 max-w-2xl text-body leading-relaxed text-faint">
          Offence <span className="tnum text-dim">{groupNumber(Math.round(power.offence))}</span> ·
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
