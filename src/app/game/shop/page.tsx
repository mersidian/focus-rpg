import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Rows } from "@/components/GameUi";
import { loadWallet, bankUsage } from "@/lib/inventory-service";
import {
  bankSlotCost,
  buyPrice,
  fuelCapCost,
  rationPrice,
  repairCost,
  sellPrice,
  tierValue,
  FUEL_CAP_BASE,
  FUEL_CAP_MAX,
  FUEL_CAP_STEP,
} from "@/lib/game/economy";
import { TIERS } from "@/lib/game/tiers";
import { groupNumber } from "@/lib/format";
import { shopGroups } from "@/lib/shop-service";
import { tierForHours } from "@/lib/game/tiers";
import { loadState } from "@/lib/game-state";
import {
  BuyButton,
  BuyFuelCapButton,
  BuySlotsButton,
  ExchangeStonesButton,
  SalvageOutputButtons,
} from "@/components/GameActions";
import { balances } from "@/lib/inventory-service";

export const dynamic = "force-dynamic";

/** Player-facing names for the stocked classes, in the order they are stocked. */
const CLASS_TITLE: Record<string, string> = {
  tool: "Tools",
  ammo: "Ammunition",
  consumable: "Rations and tonics",
  stone: "Upgrade stones",
  seed: "Seeds",
};

export default async function ShopPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const [wallet, usage, state] = await Promise.all([
    loadWallet(session.user.id),
    bankUsage(session.user.id),
    loadState(session.user.id),
  ]);
  // The shop stocks a tier above what your hours have opened, so there is always
  // something to save for.
  const openTier = Math.min(24, tierForHours(state.lifetimeFocusedMs / 3_600_000) + 1);
  const stock = shopGroups(openTier, 24);

  // Which stone tiers are actually held, so the exchange only offers real trades.
  const held = await balances(session.user.id);
  const stoneTiers = [
    ...new Set(
      [...held.entries()]
        .filter(([id, qty]) => id.startsWith("stone:") && qty > 0)
        .map(([id]) => Number(id.split(":")[2])),
    ),
  ].sort((a, b) => a - b);
  const capStep = Math.max(0, Math.round((wallet.fuelCap - FUEL_CAP_BASE) / FUEL_CAP_STEP));

  return (
    <Screen
      title="Shop"
      lead={
        <>
          Buying and selling both happen here, in one place — coins only ever change hands at the
          shop. Prices are fixed and there is no market to watch: a fluctuating economy is a
          spreadsheet minigame, and watching a price chart is exactly the attention this app exists
          to protect.
        </>
      }
    >
      <p className="mt-6 text-[13px] text-faint">
        <span className="tnum text-dim">{groupNumber(wallet.coins)}</span> coins
      </p>

      <Block title="Upgrades" aside="the sinks">
        <div className="mt-4 flex flex-wrap gap-4">
          <BuySlotsButton />
          <BuyFuelCapButton />
        </div>
        <div className="mt-5 space-y-3 border-t border-rule pt-4">
          <SalvageOutputButtons current={wallet.salvageOutput} />
          <p className="max-w-2xl text-[13px] leading-relaxed text-faint">
            Upgrade stones had one faucet — this shop — which also sells bank slots, the largest
            coin sink in the game. So refinement, the deepest gear axis, was funded by money and
            competed with the sink the economy is built around. Set salvage to stones and the junk
            your threshold already ate pays for refinement instead.
          </p>
          <div>
            <ExchangeStonesButton tiers={stoneTiers} />
            <p className="mt-2 text-[12px] text-faint">
              Downward only, and at a cut. Trading up would let a hoard of tier-1 junk refine a
              Mythic weapon, and the cost curve is the whole of refinement.
            </p>
          </div>
        </div>
        <Rows
          head={["", "Now", "Next", "Cost"]}
          rows={[
            [
              "Bank slots",
              groupNumber(usage.slots),
              groupNumber(usage.slots + 10),
              groupNumber(bankSlotCost(usage.slots)),
            ],
            [
              "Fuel cap",
              groupNumber(wallet.fuelCap),
              wallet.fuelCap >= FUEL_CAP_MAX ? "maxed" : groupNumber(wallet.fuelCap + FUEL_CAP_STEP),
              wallet.fuelCap >= FUEL_CAP_MAX ? "—" : groupNumber(fuelCapCost(capStep)),
            ],
          ]}
        />
        <p className="mt-4 text-[13px] leading-relaxed text-faint">
          Bank slots are the largest sink in the game, and the reason late-game coin income has
          somewhere to go.
        </p>
      </Block>

      <Block title="In stock" aside={`up to tier ${openTier}`}>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-faint">
          Tools, ammunition, rations, upgrade stones and seeds. Everything else has to be made or
          found — the shop will not sell you a weapon you could smith.
        </p>
      </Block>

      {stock.map((group) => (
        <Block key={group.cls} title={CLASS_TITLE[group.cls]} aside={`${group.total} in stock`}>
          <Rows
            head={["Item", "Tier", "Price", ""]}
            rows={group.items.map((i) => [
              i.name,
              String(i.tier),
              groupNumber(i.price),
              <BuyButton key="b" itemId={i.id} />,
            ])}
            total={group.total}
          />
        </Block>
      ))}

      <Block title="Prices" aside="V(T) = 10 × 1.20^(T−1)">
        <Rows
          head={["Tier", "Unit value", "Ration", "Repair", "Buy equipment", "Sell equipment"]}
          rows={TIERS.filter((t) => t.tier % 3 === 0 || t.tier === 1).map((t) => [
            <span key="t" className="text-dim">
              {t.tier} · {t.metal}
            </span>,
            groupNumber(tierValue(t.tier)),
            groupNumber(rationPrice(t.tier)),
            groupNumber(repairCost(t.tier)),
            groupNumber(buyPrice(t.tier, "equipment")),
            groupNumber(sellPrice(t.tier, "equipment")),
          ])}
        />
        <p className="mt-4 text-[13px] leading-relaxed text-faint">
          Selling always pays less than buying costs, and one curve prices everything so value and
          strength climb at the same rate. Auto-repair is{" "}
          <span style={{ color: "var(--tier)" }}>{wallet.autoRepair ? "on" : "off"}</span> — with it
          on you should never see a repair screen unless you are broke.
        </p>
      </Block>
    </Screen>
  );
}
