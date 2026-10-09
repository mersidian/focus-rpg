"use client";

import { useState } from "react";
import Link from "next/link";
import { ActionButton } from "./ActionButton";
import {
  buyBankSlotsAction,
  buyFuelCapAction,
  buyPlotAction,
  dropContractAction,
  equipAction,
  harvestPlotAction,
  refineItemAction,
  repairAllAction,
  sellInstanceAction,
  sowPlotAction,
  takeContractAction,
  unequipAction,
  setSalvageOutputAction,
  exchangeStonesAction,
} from "@/lib/actions";

/**
 * The buttons, one per action.
 *
 * A server component cannot hand a function to a client one, so each of these
 * takes plain data and binds the action itself. That keeps every game screen a
 * server component — they read a lot and the reads are cheap on the server.
 */


export function EquipButton({ instanceId }: { instanceId: string }) {
  return <ActionButton quiet label="Wear" run={() => equipAction(instanceId)} />;
}

export function UnequipButton({ slot }: { slot: string }) {
  return <ActionButton quiet label="Take off" run={() => unequipAction(slot)} />;
}

export function RefineButton({ instanceId, step }: { instanceId: string; step: number }) {
  return <ActionButton quiet label={`Refine to +${step}`} run={() => refineItemAction(instanceId)} />;
}

export function RepairButton() {
  return <ActionButton label="Mend everything" run={() => repairAllAction()} />;
}

export function SellInstanceButton({ instanceId }: { instanceId: string }) {
  return <ActionButton quiet label="Sell" run={() => sellInstanceAction(instanceId)} />;
}

export function BuySlotsButton() {
  return <ActionButton label="Buy ten slots" run={() => buyBankSlotsAction()} />;
}

export function BuyFuelCapButton() {
  return <ActionButton label="Raise the cap" run={() => buyFuelCapAction()} />;
}

export function BuyPlotButton() {
  return <ActionButton label="Break another plot" run={() => buyPlotAction()} />;
}

export function SowButton({
  slot,
  seeds,
}: {
  slot: number;
  seeds: { itemId: string; qty: number; line: string; tier: number }[];
}) {
  const [seed, setSeed] = useState(seeds[0]?.itemId ?? "");
  // An empty state that says where seed comes from, rather than "no seeds".
  if (seeds.length === 0) {
    return (
      <Link href="/game/shop" className="btn-quiet">
        Buy seed
      </Link>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <select
        value={seed}
        onChange={(e) => setSeed(e.target.value)}
        aria-label="Which seed"
        className="h-8 rounded-[4px] border border-rule bg-ground px-2 text-note text-text"
      >
        {seeds.map((s) => (
          <option key={s.itemId} value={s.itemId}>
            {s.line} t{s.tier} ({s.qty})
          </option>
        ))}
      </select>
      <ActionButton quiet label="Sow" run={() => sowPlotAction(slot, seed)} />
    </span>
  );
}

export function HarvestButton({ slot }: { slot: number }) {
  return <ActionButton quiet label="Harvest" run={() => harvestPlotAction(slot)} />;
}

export function SalvageOutputButtons({ current }: { current: "coins" | "stones" }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-4">
      <span className="text-note text-faint">
        Salvage pays <span className="text-dim">{current}</span>
      </span>
      <ActionButton
        quiet
        label={current === "coins" ? "Pay stones instead" : "Pay coins instead"}
        run={() => setSalvageOutputAction(current === "coins" ? "stones" : "coins")}
      />
    </span>
  );
}

export function ExchangeStonesButton({ tiers }: { tiers: number[] }) {
  const [from, setFrom] = useState(tiers[tiers.length - 1] ?? 2);
  const [to, setTo] = useState(1);
  const [qty, setQty] = useState(1);
  if (tiers.length === 0) return <span className="text-note text-faint">no stones</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <select
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
        aria-label="How many"
        className="h-8 rounded-[4px] border border-rule bg-ground px-2 text-note text-text"
      >
        {[1, 5, 20, 100].map((n) => (
          <option key={n} value={n}>
            ×{n}
          </option>
        ))}
      </select>
      <select
        value={from}
        onChange={(e) => setFrom(Number(e.target.value))}
        aria-label="From tier"
        className="h-8 rounded-[4px] border border-rule bg-ground px-2 text-note text-text"
      >
        {tiers.map((t) => (
          <option key={t} value={t}>
            from t{t}
          </option>
        ))}
      </select>
      <select
        value={to}
        onChange={(e) => setTo(Number(e.target.value))}
        aria-label="To tier"
        className="h-8 rounded-[4px] border border-rule bg-ground px-2 text-note text-text"
      >
        {Array.from({ length: Math.max(1, from - 1) }, (_, i) => i + 1).map((t) => (
          <option key={t} value={t}>
            to t{t}
          </option>
        ))}
      </select>
      <ActionButton quiet label="Trade down" run={() => exchangeStonesAction(from, to, qty)} />
    </span>
  );
}

export function TakeContractButton() {
  return <ActionButton label="Take a contract" run={() => takeContractAction()} />;
}

export function DropContractButton() {
  return <ActionButton quiet label="Drop it" run={() => dropContractAction()} />;
}
