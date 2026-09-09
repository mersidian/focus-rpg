import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Rows, Gate } from "@/components/GameUi";
import { loadGateState } from "@/lib/game-view-service";
import { requirementFor } from "@/lib/game/requirements";
import { checkGate } from "@/lib/game/gate";
import { BIOMES } from "@/lib/game/biomes";
import { areasIn } from "@/lib/game/variants";
import { SKILLS } from "@/lib/game/skills";

export const dynamic = "force-dynamic";

const LABEL = new Map(SKILLS.map((s) => [s.key, s.label]));

export default async function AreasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const state = await loadGateState(session.user.id);

  return (
    <Screen
      title="Areas"
      lead="Twenty biomes of ten areas, gated by tier rather than chained in order — you may go anywhere you can meet the gate. A closed area names what it wants, so it reads as a shopping list rather than a refusal."
    >
      {BIOMES.map((biome) => {
        const areas = areasIn(biome);
        const anyOpen = areas.some(
          (a) => checkGate(requirementFor({ kind: "combat", biome: biome.index, area: a.index }), state, (k) => LABEL.get(k) ?? k).open,
        );
        return (
          <Block
            key={biome.index}
            title={`${biome.index}. ${biome.name}`}
            aside={`tiers ${biome.tierLo}–${biome.tierHi} · ${biome.affinity.length > 3 ? "all skills" : biome.affinity.map((a) => LABEL.get(a) ?? a).join(", ")}${anyOpen ? "" : " · closed"}`}
          >
            <Rows
              head={["Area", "Tier", "Monsters", "Gate"]}
              rows={areas.map((area) => {
                const gate = checkGate(
                  requirementFor({ kind: "combat", biome: biome.index, area: area.index }),
                  state,
                  (k) => LABEL.get(k) ?? k,
                );
                return [
                  area.name,
                  String(area.tier),
                  String(area.roster.length),
                  <Gate key="g" open={gate.open} missing={gate.missing} />,
                ];
              })}
            />
            {biome.keyItem && (
              <p className="mt-3 text-[12px] text-faint">
                Holds a key item: <span style={{ color: "var(--tier)" }}>{biome.keyItem}</span>
              </p>
            )}
          </Block>
        );
      })}
    </Screen>
  );
}
