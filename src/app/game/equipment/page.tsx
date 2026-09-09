import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Rows, Empty } from "@/components/GameUi";
import { instances } from "@/lib/game-view-service";
import { loadEquipped } from "@/lib/activity-service";
import { loadoutPower, SLOTS, MAX_REFINE } from "@/lib/game/power";
import { BEATS } from "@/lib/game/archetypes";
import { refineStoneCost, refineCoinCost } from "@/lib/game/economy";
import { groupNumber } from "@/lib/format";

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
  const spare = owned.filter((i) => !i.equippedSlot);

  return (
    <Screen
      title="Equipment"
      lead={
        <>
          Ten slots, four styles, one 24-tier spine. Every piece carries three axes that move
          independently: the tier it is, the quality window it landed in, and how far it has been
          refined — up to +{MAX_REFINE}. The percentile is where its roll sits in its own band.
        </>
      }
    >
      <Block title="Worn" aside={style ? `${style} · strong against ${BEATS[style]}` : "no style"}>
        <Rows
          head={["Slot", "Item", "Roll", "Refine", "Durability"]}
          rows={SLOTS.map((slot) => {
            const item = worn.find((i) => i.equippedSlot === slot);
            if (!item) {
              return [
                slot,
                <span key="e" className="text-faint">
                  empty
                </span>,
                "—",
                "—",
                "—",
              ];
            }
            return [
              slot,
              <span key="n" className="text-dim">
                {item.name}
                {item.refine > 0 && (
                  <span style={{ color: "var(--tier)" }}> +{item.refine}</span>
                )}
              </span>,
              `${Math.round(item.percentile * 100)}%`,
              item.refine > 0 ? `+${item.refine}` : "—",
              item.durability <= 0 ? "Worn" : `${item.durability}%`,
            ];
          })}
        />
        <p className="mt-4 text-[13px] leading-relaxed text-faint">
          Offence <span className="tnum text-dim">{groupNumber(Math.round(power.offence))}</span> ·
          defence <span className="tnum text-dim">{groupNumber(Math.round(power.defence))}</span>.
          An empty slot counts as tier zero at the requirement gate, so a full set matters before
          a better one does. Worn gear is never destroyed — it is halved until repaired.
        </p>
      </Block>

      <Block title="In the bank" aside={`${spare.length} pieces`}>
        {spare.length === 0 ? (
          <Empty>No spare gear. Equipment only drops from things worth fighting.</Empty>
        ) : (
          <Rows
            head={["Item", "Slot", "Tier", "Quality", "Roll"]}
            rows={spare.slice(0, 60).map((i) => [
              i.name,
              i.slot,
              String(i.tier),
              i.quality,
              `${Math.round(i.percentile * 100)}%`,
            ])}
          />
        )}
      </Block>

      <Block title="Refinement" aside="never fails">
        <p className="mt-3 text-[13px] leading-relaxed text-faint">
          Failure costs the stones and the coins and nothing else — no downgrade, and nothing is
          ever destroyed. So every item reaches +{MAX_REFINE} eventually, and the cost curve is the
          only thing standing in the way.
        </p>
        <Rows
          head={["Step", "Stones", "Coins at tier 12"]}
          rows={Array.from({ length: MAX_REFINE }, (_, i) => [
            `+${i + 1}`,
            String(refineStoneCost(i + 1)),
            groupNumber(refineCoinCost(i + 1, 12)),
          ])}
        />
      </Block>
    </Screen>
  );
}
