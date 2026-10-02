import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Screen, Block, Rows } from "@/components/GameUi";
import { loadWallet, bankUsage } from "@/lib/inventory-service";
import {
  bankSlotCost,
  fuelCapCost,
  FUEL_CAP_BASE,
  FUEL_CAP_MAX,
  FUEL_CAP_STEP,
} from "@/lib/game/economy";
import { groupNumber } from "@/lib/format";
import { shopStock } from "@/lib/shop-service";
import { tierForHours } from "@/lib/game/tiers";
import { loadState } from "@/lib/game-state";
import { skillUnlock } from "@/lib/game/skills";
import {
  BuyFuelCapButton,
  BuySlotsButton,
  ExchangeStonesButton,
  SalvageOutputButtons,
} from "@/components/GameActions";
import { balances } from "@/lib/inventory-service";
import { ShopFilter } from "@/components/ShopFilter";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  // Started, not awaited, so `bankUsage` shares this read instead of repeating
  // it and the page still resolves in one wave.
  const walletPromise = loadWallet(session.user.id);
  const [wallet, usage, state] = await Promise.all([
    walletPromise,
    bankUsage(session.user.id, walletPromise),
    loadState(session.user.id),
  ]);
  // The shop stocks a tier above what your hours have opened, so there is always
  // something to save for.
  const openTier = Math.min(24, tierForHours(state.lifetimeFocusedMs / 3_600_000) + 1);
  /*
   * A tool for a skill you cannot use yet is not stock, it is a trap with a
   * price on it: the shop would happily sell a level-1 character an excavation
   * pick that nothing will let them swing until level 12. Tools are the only
   * class on the shelf that belongs to a skill, so this is the only filter the
   * unlock ladder needs here.
   */
  const stock = shopStock(openTier).filter((i) => !i.skill || skillUnlock(i.skill) <= state.level);

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
      lead="Fixed prices, paid in coins. Selling happens from the bank."
    >
      <p className="mt-6 text-body text-faint">
        <span className="tnum text-dim">{groupNumber(wallet.coins)}</span> coins
      </p>

      <Block title="In stock" aside={`up to tier ${openTier}`}>
        <p className="mt-3 max-w-2xl text-body leading-relaxed text-faint">
          Tools, ammunition, rations, upgrade stones and seed. Weapons and armour are made or
          found, never sold.
        </p>
        <ShopFilter
          rows={stock.map((i) => ({
            id: i.id,
            name: i.name,
            cls: i.cls,
            skill: i.skill,
            tier: i.tier,
            price: i.price,
            held: held.get(i.id) ?? 0,
            grade: i.quality,
          }))}
          coins={wallet.coins}
        />
      </Block>

      <Block title="Upgrades">
        <div className="mt-4 flex flex-wrap gap-4">
          <BuySlotsButton />
          <BuyFuelCapButton />
        </div>
        <div className="mt-5 space-y-3 border-t border-rule pt-4">
          <SalvageOutputButtons current={wallet.salvageOutput} />
          {/*
            What the choice is, not how it came to be offered. This paragraph
            was the commit message for the feature: which faucet stones used to
            have and what that did to the economy.
          */}
          <p className="max-w-2xl text-body leading-relaxed text-faint">
            What auto-salvage turns unwanted gear into: coins, or upgrade stones of the piece&apos;s
            own tier.
          </p>
          <div>
            <ExchangeStonesButton tiers={stoneTiers} />
            <p className="mt-2 text-note text-faint">
              Deep stones into shallower ones, at a cut. Never the other way.
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
        <p className="mt-4 text-body leading-relaxed text-faint">
          Auto-repair is{" "}
          <span style={{ color: "var(--tier)" }}>{wallet.autoRepair ? "on" : "off"}</span>
          {wallet.autoRepair && ", so worn gear is mended as long as you can pay for it"}.{" "}
          <Link href="/wiki/game?s=sinks" className="text-dim underline underline-offset-2">
            Every price by tier
          </Link>
          .
        </p>
      </Block>
    </Screen>
  );
}
