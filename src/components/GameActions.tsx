"use client";

import { useState } from "react";
import { ActionButton } from "./ActionButton";
import {
  buyBankSlotsAction,
  buyFuelCapAction,
  buyPlotAction,
  buyStockAction,
  craftAction,
  dropContractAction,
  equipAction,
  harvestPlotAction,
  refineItemAction,
  repairAllAction,
  sellInstanceAction,
  sellStackAction,
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

export function CraftButton({ recipeId, label }: { recipeId: string; label?: string }) {
  const [times, setTimes] = useState(1);
  return (
    <span className="inline-flex items-baseline gap-2">
      <select
        value={times}
        onChange={(e) => setTimes(Number(e.target.value))}
        aria-label="How many"
        className="border-b border-rule bg-transparent py-0.5 text-[12px] text-dim outline-none"
      >
        {[1, 5, 10, 25, 100].map((n) => (
          <option key={n} value={n}>
            ×{n}
          </option>
        ))}
      </select>
      <ActionButton quiet label={label ?? "Make"} run={() => craftAction(recipeId, times)} />
    </span>
  );
}

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

export function SellStackButton({ itemId, held }: { itemId: string; held: number }) {
  const [qty, setQty] = useState(1);
  const options = [1, 10, 100, held].filter((n, i, all) => n > 0 && all.indexOf(n) === i);
  return (
    <span className="inline-flex items-baseline gap-2">
      <select
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
        aria-label="How many to sell"
        className="border-b border-rule bg-transparent py-0.5 text-[12px] text-dim outline-none"
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {n === held ? `all ${n}` : n}
          </option>
        ))}
      </select>
      <ActionButton quiet label="Sell" run={() => sellStackAction(itemId, qty)} />
    </span>
  );
}

export function BuyButton({ itemId }: { itemId: string }) {
  const [qty, setQty] = useState(1);
  return (
    <span className="inline-flex items-baseline gap-2">
      <select
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
        aria-label="How many to buy"
        className="border-b border-rule bg-transparent py-0.5 text-[12px] text-dim outline-none"
      >
        {[1, 10, 50, 200].map((n) => (
          <option key={n} value={n}>
            ×{n}
          </option>
        ))}
      </select>
      <ActionButton quiet label="Buy" run={() => buyStockAction(itemId, qty)} />
    </span>
  );
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
  if (seeds.length === 0) {
    return <span className="text-[12px] text-faint">no seeds</span>;
  }
  return (
    <span className="inline-flex items-baseline gap-2">
      <select
        value={seed}
        onChange={(e) => setSeed(e.target.value)}
        aria-label="Which seed"
        className="border-b border-rule bg-transparent py-0.5 text-[12px] text-dim outline-none"
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
    <span className="inline-flex flex-wrap items-baseline gap-4">
      <span className="text-[12px] text-faint">
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
  if (tiers.length === 0) return <span className="text-[12px] text-faint">no stones</span>;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-2">
      <select
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
        aria-label="How many"
        className="border-b border-rule bg-transparent py-0.5 text-[12px] text-dim outline-none"
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
        className="border-b border-rule bg-transparent py-0.5 text-[12px] text-dim outline-none"
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
        className="border-b border-rule bg-transparent py-0.5 text-[12px] text-dim outline-none"
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
