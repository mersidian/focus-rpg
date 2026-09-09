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
      lead={
        <>
          A slot holds an item <em>type</em>, and stacks are unlimited inside it — four thousand
          ore is one slot. Equipment instances each take their own, which is where the pressure
          actually lands, and where the decision is worth making.
        </>
      }
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

      <Block title="Auto-salvage" aside="set once">
        <p className="mt-3 text-body leading-relaxed text-faint">
          Found gear is judged before it reaches the bank: anything below the{" "}
          <span className="tnum text-dim">{(wallet.salvageBelow / 10).toFixed(0)}%</span> band
          percentile is sold on the way in, anything above{" "}
          <span className="tnum text-dim">{(wallet.keepAbove / 10).toFixed(0)}%</span> is always
          kept. Salvage currently pays{" "}
          <span style={{ color: "var(--tier)" }}>{wallet.salvageOutput}</span>. Without these rules
          a limited bank would be a sorting job rather than a decision.
        </p>
      </Block>
    </Screen>
  );
}
