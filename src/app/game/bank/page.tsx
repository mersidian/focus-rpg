import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Empty, Gauge } from "@/components/GameUi";
import { BankVault } from "@/components/BankVault";
import { BuySlotsButton } from "@/components/GameActions";
import { bankRows } from "@/lib/game-view-service";
import { bankUsage, loadWallet } from "@/lib/inventory-service";
import { bankSlotCost } from "@/lib/game/economy";
import { groupNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BankPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const [rows, usage, wallet] = await Promise.all([
    bankRows(session.user.id),
    bankUsage(session.user.id),
    loadWallet(session.user.id),
  ]);

  const gear = usage.used - rows.length;
  const worth = rows.reduce((n, r) => n + r.worth * r.qty, 0);
  const free = Math.max(0, usage.slots - usage.used);

  return (
    <Screen title="Bank" lead="One slot for each kind of item, however many you stack.">
      {/*
        The three facts a bank has, as figures. They were one sentence of the
        faintest text on the page, joined with middle dots, and the button that
        buys more room was on another screen.
      */}
      <div className="mt-8 grid gap-x-12 gap-y-6 border-y border-rule py-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Gauge label="Slots" value={usage.used} cap={usage.slots} />
          <p className="mt-2 text-note text-faint">
            <span className="tnum" style={free === 0 ? { color: "var(--color-warn)" } : undefined}>
              {groupNumber(free)}
            </span>{" "}
            free
            {gear > 0 && (
              <>
                .{" "}
                <Link href="/game/equipment" className="text-dim underline underline-offset-2">
                  <span className="tnum">{groupNumber(gear)}</span>{" "}
                  {gear === 1 ? "piece" : "pieces"} of gear
                </Link>{" "}
                {gear === 1 ? "takes" : "take"} a slot each
              </>
            )}
            .
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <BuySlotsButton />
            <span className="text-note text-faint">
              <span className="tnum text-dim">{groupNumber(bankSlotCost(usage.slots))}</span> coins
              for ten more
            </span>
          </div>
        </div>
        <p className="text-note text-faint">
          <span className="tnum block text-head leading-none" style={{ color: "var(--tier)" }}>
            {groupNumber(wallet.coins)}
          </span>
          <span className="mt-1.5 block">coins</span>
        </p>
        <p className="text-note text-faint">
          <span className="tnum block text-head leading-none text-dim">{groupNumber(worth)}</span>
          <span className="mt-1.5 block">what the shop would pay for all of it</span>
        </p>
      </div>

      {rows.length === 0 ? (
        <Empty>
          Nothing banked yet. Choose something to gather before your next session and it lands
          here when the timer finishes.
        </Empty>
      ) : (
        <BankVault rows={rows} />
      )}

      <Block title="Auto-salvage">
        <p className="mt-3 max-w-2xl text-body leading-relaxed text-faint">
          Gear you find is sorted on the way in. A piece in the bottom{" "}
          <span className="tnum text-dim">{(wallet.salvageBelow / 10).toFixed(0)}%</span> of its
          range is salvaged for{" "}
          <span style={{ color: "var(--tier)" }}>{wallet.salvageOutput}</span>; one in the top{" "}
          <span className="tnum text-dim">{(100 - wallet.keepAbove / 10).toFixed(0)}%</span> is
          always kept.{" "}
          <Link href="/game/shop" className="text-dim underline underline-offset-2">
            Change what salvage pays
          </Link>
          .
        </p>
      </Block>
    </Screen>
  );
}
