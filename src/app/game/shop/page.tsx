import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Screen, Block } from "@/components/GameUi";
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

  const capMaxed = wallet.fuelCap >= FUEL_CAP_MAX;
  const upgrades = [
    {
      name: "Bank slots",
      now: usage.slots,
      next: usage.slots + 10,
      cost: bankSlotCost(usage.slots),
      button: <BuySlotsButton key="b" />,
    },
    {
      name: "Fuel cap",
      now: wallet.fuelCap,
      next: capMaxed ? null : wallet.fuelCap + FUEL_CAP_STEP,
      cost: capMaxed ? null : fuelCapCost(capStep),
      button: <BuyFuelCapButton key="f" />,
    },
  ];

  return (
    <Screen title="Shop" lead="Fixed prices, paid in coins. Selling happens from the bank.">
      {/*
        The shelf and the counter, side by side once there is room. The
        upgrades were under 192 cells of stock, as two buttons with no price on
        them and a table further down that had the prices.
      */}
      <div className="mt-10 grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Block flush title="On the shelf" aside={`up to tier ${openTier}`}>
          <p className="mt-3 max-w-[62ch] text-body text-faint">
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

        <aside className="space-y-10">
          <p className="text-note text-faint">
            <span className="tnum block text-title leading-none" style={{ color: "var(--tier)" }}>
              {groupNumber(wallet.coins)}
            </span>
            <span className="mt-2 block">coins to spend</span>
          </p>

          <Block flush title="Upgrades">
            <ul className="mt-4 space-y-3">
              {upgrades.map((u) => (
                <li key={u.name} className="slot p-4">
                  <p className="text-note text-faint">{u.name}</p>
                  {/* Now and next as one figure: what you have, and what the
                      button turns it into. */}
                  <p className="tnum mt-1 text-stat leading-none text-text">
                    {groupNumber(u.now)}
                    {u.next !== null && (
                      <span className="text-faint">
                        {" "}
                        to <span style={{ color: "var(--tier)" }}>{groupNumber(u.next)}</span>
                      </span>
                    )}
                  </p>
                  {u.cost === null ? (
                    <p className="mt-3 text-note text-faint">As high as it goes.</p>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {u.button}
                      <span
                        className="tnum text-note"
                        style={{
                          color: u.cost > wallet.coins ? "var(--color-warn)" : "var(--color-dim)",
                        }}
                      >
                        {groupNumber(u.cost)} coins
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Block>

          <Block flush title="Salvage">
            <p className="mt-3 text-body text-faint">
              What auto-salvage turns unwanted gear into: coins, or upgrade stones of the
              piece&apos;s own tier.
            </p>
            <div className="mt-3">
              <SalvageOutputButtons current={wallet.salvageOutput} />
            </div>
            <p className="mt-4 text-body text-faint">
              Auto-repair is{" "}
              <span style={{ color: "var(--tier)" }}>{wallet.autoRepair ? "on" : "off"}</span>
              {wallet.autoRepair && ", so worn gear is mended as long as you can pay for it"}.
            </p>
          </Block>

          <Block flush title="Trade stones down">
            {stoneTiers.length === 0 ? (
              <p className="mt-3 text-body text-faint">
                You hold no upgrade stones. Salvage, contracts and Jewelcrafting make them.
              </p>
            ) : (
              <>
                <p className="mt-3 text-body text-faint">
                  Deep stones into shallower ones, at a cut. Never the other way.
                </p>
                <div className="mt-3">
                  <ExchangeStonesButton tiers={stoneTiers} />
                </div>
              </>
            )}
          </Block>

          <p className="text-note text-faint">
            <Link href="/wiki/game?s=sinks" className="text-dim underline underline-offset-2">
              Every price by tier
            </Link>
          </p>
        </aside>
      </div>
    </Screen>
  );
}
