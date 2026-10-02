import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Screen, Block, Empty } from "@/components/GameUi";
import { BankFilter } from "@/components/BankFilter";
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

  return (
    <Screen
      title="Bank"
      lead="One slot for each kind of item, however many you stack. Every piece of gear takes a slot of its own."
    >
      <p className="mt-6 text-body text-faint">
        <span className="tnum text-dim">{groupNumber(usage.used)}</span> of{" "}
        <span className="tnum">{groupNumber(usage.slots)}</span> slots used · next ten cost{" "}
        <span className="tnum text-dim">{groupNumber(bankSlotCost(usage.slots))}</span> coins · you
        have <span className="tnum text-dim">{groupNumber(wallet.coins)}</span>
      </p>

      {rows.length === 0 ? (
        <Empty>
          Nothing banked yet. Pick a gathering activity before your next session and it will land
          here when the timer finishes.
        </Empty>
      ) : (
        <BankFilter rows={rows} />
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
