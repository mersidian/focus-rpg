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
import { shopStock } from "@/lib/shop-service";
import { tierForHours } from "@/lib/game/tiers";
import { loadState } from "@/lib/game-state";
import { BuyButton, BuyFuelCapButton, BuySlotsButton } from "@/components/GameActions";

export const dynamic = "force-dynamic";

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
  const stock = shopStock(openTier);
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
        <Rows
          head={["Item", "Class", "Tier", "Price", ""]}
          rows={stock.slice(0, 80).map((i) => [
            i.name,
            <span key="c" className="text-faint">
              {i.cls}
            </span>,
            String(i.tier),
            groupNumber(i.price),
            <BuyButton key="b" itemId={i.id} />,
          ])}
        />
      </Block>

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
