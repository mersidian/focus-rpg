import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Rows, Empty, Gauge, DepthRange } from "@/components/GameUi";
import { MAX_TIER } from "@/lib/game/tiers";
import { overview } from "@/lib/game-view-service";
import { skillViews } from "@/lib/game-view-service";
import { BIOMES } from "@/lib/game/biomes";
import { variantsIn } from "@/lib/game/variants";
import { groupNumber } from "@/lib/format";
import { DropContractButton, TakeContractButton } from "@/components/GameActions";

export const dynamic = "force-dynamic";

export default async function SlayingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const [o, skills] = await Promise.all([overview(session.user.id), skillViews(session.user.id)]);
  const slaying = skills.find((s) => s.key === "slaying");
  const level = slaying?.level ?? 1;

  // The ladder is the route through 200 areas that open tier gating leaves
  // deliberately unordered. A contract tier opens roughly every four levels.
  const openBiomes = BIOMES.filter((b) => b.tierLo <= Math.max(2, Math.round(level / 4) + 2));

  return (
    <Screen
      title="Slaying"
      lead={
        <>
          One contract at a time, and it <strong>never expires</strong> — it waits across a week of
          scattered sessions if that is how the week goes. Daily contracts were rejected: three a
          day or lose them is a login incentive, and this app already has a healthier one in the
          streak.
        </>
      }
    >
      <Block title="Current contract" aside={`Slaying ${level}`}>
        {o.contract === null ? (
          <>
            <Empty>
              None taken. With 200 areas and no corridor through them, the contract ladder is what
              says where to go next.
            </Empty>
            <div className="mt-4">
              <TakeContractButton />
            </div>
          </>
        ) : (
          <div className="mt-4 text-body">
            {/* A contract is a ratio with a name on it, which is what a gauge is. */}
            <Gauge
              label={o.contract.variantName}
              value={o.contract.killed}
              cap={o.contract.required}
            />
            <p className="mt-3 text-note text-faint">
              It never expires. <DropContractButton /> costs nothing — nothing here punishes
              changing your mind.
            </p>
          </div>
        )}
      </Block>

      <Block title="Where the ladder currently reaches" aside={`${openBiomes.length} of ${BIOMES.length} biomes`}>
        <Rows
          head={["Biome", "Tiers", "Targets"]}
          rows={openBiomes.map((b) => [
            b.name,
            <DepthRange key="t" lo={b.tierLo} hi={b.tierHi} steps={MAX_TIER} />,
            groupNumber(variantsIn(b).length),
          ])}
        />
        <p className="mt-4 text-body leading-relaxed text-faint">
          Higher Slaying levels name deeper biomes and rarer variants, so the ladder doubles as the
          guided route through content that otherwise has no suggested order.
        </p>
      </Block>
    </Screen>
  );
}
