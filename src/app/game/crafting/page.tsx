import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen } from "@/components/GameUi";
import { itemName } from "@/lib/game-view-service";
import { loadSkills } from "@/lib/activity-service";
import { balances, loadWallet } from "@/lib/inventory-service";
import { allRecipes, canCraft } from "@/lib/game/recipes";
import { itemIndex } from "@/lib/game/items";
import { SKILLS } from "@/lib/game/skills";
import { groupNumber } from "@/lib/format";
import { CraftFilter, type CraftRow } from "@/components/CraftFilter";

export const dynamic = "force-dynamic";

const PROCESSING = SKILLS.filter((s) => s.kind === "processing");
const LABEL = new Map(PROCESSING.map((s) => [s.key, s.label]));

export default async function CraftingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const [skills, held, wallet] = await Promise.all([
    loadSkills(session.user.id),
    balances(session.user.id),
    loadWallet(session.user.id),
  ]);

  const recipes = allRecipes();
  // Names the mark and its hue. Every crafted output is a catalogue row, so
  // the fallback is a safety net rather than a path anything takes.
  const CATALOGUE = itemIndex();
  const have = (id: string) => held.get(id) ?? 0;

  /*
   * Assembled here rather than shipped whole. The client needs a name, a couple
   * of counts and a verdict per row; it does not need two thousand recipes or
   * the inventory they are checked against, so both stay on the server and only
   * what is within reach of your level crosses the boundary.
   */
  const rows: CraftRow[] = recipes
    .filter((r) => r.level <= (skills[r.skill] ?? 1) + 8)
    .map((r) => {
      const level = skills[r.skill] ?? 1;
      const check = canCraft(r, have, wallet.fuel, level, itemName);
      const made = CATALOGUE.get(r.outputId);
      return {
        id: r.id,
        outputId: r.outputId,
        outputClass: made?.cls ?? "refined",
        outputSkill: made?.skill,
        outputStyle: made?.style,
        skill: r.skill,
        skillLabel: LABEL.get(r.skill) ?? r.skill,
        name: r.outputName,
        qty: r.outputQty,
        held: have(r.outputId),
        tier: r.tier,
        fuel: r.fuel,
        level: r.level,
        inputs: r.inputs.map((i) => ({
          name: itemName(i.itemId),
          need: i.qty,
          have: have(i.itemId),
        })),
        ok: check.ok,
        missing: check.ok ? null : (check.missing[0] ?? "not yet"),
      };
    });

  return (
    <Screen
      title="Crafting"
      lead={
        <>
          {PROCESSING.length} processing skills, {groupNumber(recipes.length)} recipes, all
          generated from the tier spine — adding a tier adds about forty of them. Fuel pays for
          every one, which is fuel&apos;s entire job: every <em>meaningful</em> action is a
          session, and fuel covers the trivia that should never cost twenty-five real minutes.
        </>
      }
    >
      <CraftFilter rows={rows} fuel={wallet.fuel} />
    </Screen>
  );
}
