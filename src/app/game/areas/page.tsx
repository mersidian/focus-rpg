import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Rows, Gate, DepthValue, DepthRange } from "@/components/GameUi";
import { MAX_TIER } from "@/lib/game/tiers";
import { loadGateState } from "@/lib/game-view-service";
import { requirementFor } from "@/lib/game/requirements";
import { checkGate } from "@/lib/game/gate";
import { BIOMES } from "@/lib/game/biomes";
import { areasIn } from "@/lib/game/variants";
import { SKILLS } from "@/lib/game/skills";

export const dynamic = "force-dynamic";

const LABEL = new Map(SKILLS.map((s) => [s.key, s.label]));
const label = (k: string) => LABEL.get(k) ?? k;

export default async function AreasPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const state = await loadGateState(session.user.id);
  const { b } = await searchParams;

  /*
   * The page used to render all twenty biomes at once: two hundred rows in
   * twenty visually identical tables, and for a new account every one of them
   * read "needs …". It also evaluated every gate twice — once for the row and
   * again across all ten just to decide whether to append " · closed" to the
   * heading — so four hundred gate checks per load, to draw a wall.
   *
   * The index is the same information at the grain a decision is made at: which
   * biome has anything open. Nothing is hidden; one is expanded at a time.
   */
  const summaries = BIOMES.map((biome) => {
    const gates = areasIn(biome).map((area) => ({
      area,
      gate: checkGate(
        requirementFor({ kind: "combat", biome: biome.index, area: area.index }),
        state,
        label,
      ),
    }));
    return { biome, gates, open: gates.filter((g) => g.gate.open).length };
  });

  const wanted = Number(b);
  const selected = summaries.find((s) => s.biome.index === wanted) ?? null;
  const reachable = summaries.filter((s) => s.open > 0).length;

  return (
    <Screen
      title="Areas"
      lead="Twenty biomes of ten areas, gated by tier rather than chained in order — you may go anywhere you can meet the gate. A closed area names what it wants, so it reads as a shopping list rather than a refusal."
    >
      <Block
        title="The biomes"
        aside={`${reachable} of ${BIOMES.length} have something open`}
      >
        {/*
          A list rather than a table. Five columns at 375px pushed the only
          column that matters — how many areas are open — off the right edge,
          behind a horizontal scroll with nothing to say it was there. A row
          that wraps keeps the count beside the name at every width.
        */}
        <ul className="mt-4">
          {summaries.map(({ biome, open }) => (
            <li key={biome.index} className="border-b border-rule last:border-0">
              <Link
                href={`/game/areas?b=${biome.index}`}
                aria-current={selected?.biome.index === biome.index ? "true" : undefined}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 text-body transition-colors hover:text-text"
              >
                <span
                  className="min-w-0 flex-1 text-dim"
                  style={
                    selected?.biome.index === biome.index ? { color: "var(--tier)" } : undefined
                  }
                >
                  {biome.index}. {biome.name}
                </span>
                <span className="shrink-0 text-body">
                  <DepthRange lo={biome.tierLo} hi={biome.tierHi} steps={MAX_TIER} />
                </span>
                <span
                  className="tnum w-16 shrink-0 text-right"
                  style={open > 0 ? { color: "var(--tier)" } : { color: "var(--color-faint)" }}
                >
                  {open} / 10
                </span>
                <span className="w-full text-note text-faint">
                  {biome.affinity.length > 3 ? "all skills" : biome.affinity.map(label).join(", ")}
                  {biome.keyItem && ` · holds ${biome.keyItem}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Block>

      {selected ? (
        <Block
          key={selected.biome.index}
          title={`${selected.biome.index}. ${selected.biome.name}`}
          aside={`tiers ${selected.biome.tierLo}–${selected.biome.tierHi} · ${
            selected.open > 0 ? `${selected.open} open` : "all closed"
          }`}
        >
          <Rows
            head={["Area", "Tier", "Monsters", "Gate"]}
            rows={selected.gates.map(({ area, gate }) => [
              area.name,
              <DepthValue key="t" step={area.tier} steps={MAX_TIER} />,
              String(area.roster.length),
              <Gate key="g" open={gate.open} missing={gate.missing} />,
            ])}
          />
          {selected.biome.keyItem && (
            <p className="mt-3 text-note text-faint">
              Holds a key item:{" "}
              <span style={{ color: "var(--tier)" }}>{selected.biome.keyItem}</span>
            </p>
          )}
        </Block>
      ) : (
        <p className="mt-8 max-w-prose text-lead leading-relaxed text-dim">
          Pick a biome to see its ten areas and what each of them wants. The ones with
          something open are the ones you can fight in today.
        </p>
      )}
    </Screen>
  );
}
