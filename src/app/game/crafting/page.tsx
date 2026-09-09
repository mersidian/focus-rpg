import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Rows } from "@/components/GameUi";
import { itemName } from "@/lib/game-view-service";
import { loadSkills } from "@/lib/activity-service";
import { balances, loadWallet } from "@/lib/inventory-service";
import { allRecipes, canCraft } from "@/lib/game/recipes";
import { SKILLS } from "@/lib/game/skills";
import { groupNumber } from "@/lib/format";
import { CraftButton } from "@/components/GameActions";

export const dynamic = "force-dynamic";

const PROCESSING = SKILLS.filter((s) => s.kind === "processing");

export default async function CraftingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const [skills, held, wallet] = await Promise.all([
    loadSkills(session.user.id),
    balances(session.user.id),
    loadWallet(session.user.id),
  ]);

  const recipes = allRecipes();
  const have = (id: string) => held.get(id) ?? 0;

  return (
    <Screen
      title="Crafting"
      lead={
        <>
          Ten processing skills, {groupNumber(recipes.length)} recipes, all generated from the tier
          spine — adding a tier adds about forty of them. Fuel pays for every one, which is fuel's
          entire job: every <em>meaningful</em> action is a session, and fuel covers the trivia
          that should never cost twenty-five real minutes.
        </>
      }
    >
      <p className="mt-6 text-[13px] text-faint">
        Fuel <span className="tnum text-dim">{groupNumber(wallet.fuel)}</span> /{" "}
        <span className="tnum">{groupNumber(wallet.fuelCap)}</span>
      </p>

      {PROCESSING.map((skill) => {
        const mine = recipes.filter((r) => r.skill === skill.key);
        const level = skills[skill.key] ?? 1;
        // Only what is reachable: a page listing 200 locked recipes is a wall.
        const reachable = mine
          .filter((r) => r.level <= level + 8)
          .sort((a, b) => a.tier - b.tier)
          .slice(0, 24);
        return (
          <Block key={skill.key} title={skill.label} aside={`level ${level} · ${mine.length} recipes`}>
            <Rows
              head={["Makes", "Needs", "Fuel", "Level", ""]}
              rows={reachable.map((r) => {
                const check = canCraft(r, have, wallet.fuel, level, itemName);
                return [
                  <span key="o" className="text-dim">
                    {r.outputName}
                    {r.outputQty > 1 && <span className="text-faint"> ×{r.outputQty}</span>}
                  </span>,
                  <span key="i" className="text-faint">
                    {r.inputs.map((i) => `${i.qty} ${itemName(i.itemId)}`).join(", ")}
                  </span>,
                  String(r.fuel),
                  String(r.level),
                  check.ok ? (
                    <CraftButton key="c" recipeId={r.id} />
                  ) : (
                    <span key="n" className="text-[12px] text-faint">
                      {check.missing[0]}
                    </span>
                  ),
                ];
              })}
            />
          </Block>
        );
      })}
    </Screen>
  );
}
