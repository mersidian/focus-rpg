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
import { MAX_BUY_AT_ONCE, MAX_CRAFT_AT_ONCE } from "@/lib/constants";

/**
 * The buttons, one per action.
 *
 * A server component cannot hand a function to a client one, so each of these
 * takes plain data and binds the action itself. That keeps every game screen a
 * server component — they read a lot and the reads are cheap on the server.
 */


/**
 * How many, as a number you type.
 *
 * It was a select of ×1 ×5 ×10 ×25 ×100, which answers "how many" with five
 * guesses — and none of them is the number you want when you hold 33 ore and a
 * bar takes two. A field takes any number; `max` fills in the largest the
 * materials, the coins and the server's own clamp allow, which is the one
 * quantity worth a shortcut.
 *
 * Clamped on the way in as well as on submit, so the box can never show a
 * figure the server would trim. A field that accepts 500 and quietly does 100
 * is a field that lies about what it did.
 */
function Quantity({
  value,
  onChange,
  max,
  cap,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  /** The most that is actually possible right now, when the caller knows it. */
  max?: number;
  /** The server's own limit on one press. */
  cap: number;
  label: string;
}) {
  const ceiling = Math.max(1, Math.min(cap, max ?? cap));
  const clamp = (n: number) => Math.max(1, Math.min(ceiling, Math.trunc(n || 1)));
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={ceiling}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        aria-label={label}
        className="tnum w-12 border-b border-rule bg-transparent py-0.5 text-right text-note text-dim focus:border-current"
        style={{ caretColor: "var(--tier)" }}
      />
      {/* Only worth offering when it is more than one and not what is already
          in the box. */}
      {ceiling > 1 && value !== ceiling && (
        <button
          type="button"
          onClick={() => onChange(ceiling)}
          className="text-note text-faint underline underline-offset-2 transition-colors hover:text-dim"
        >
          max {ceiling}
        </button>
      )}
    </span>
  );
}

export function CraftButton({
  recipeId,
  label,
  max,
}: {
  recipeId: string;
  label?: string;
  /** The most the materials and the fuel allow, worked out by the caller. */
  max?: number;
}) {
  const [times, setTimes] = useState(1);
  return (
    <span className="inline-flex items-baseline gap-2">
      <Quantity
        value={times}
        onChange={setTimes}
        max={max}
        cap={MAX_CRAFT_AT_ONCE}
        label="How many to make"
      />
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
  return (
    <span className="inline-flex items-baseline gap-2">
      {/* Selling had the same preset select, and its "all N" was only ever the
          max of what you hold — which is what the shortcut says now. */}
      <Quantity
        value={qty}
        onChange={setQty}
        max={held}
        cap={MAX_BUY_AT_ONCE}
        label="How many to sell"
      />
      <ActionButton quiet label="Sell" run={() => sellStackAction(itemId, qty)} />
    </span>
  );
}

export function BuyButton({ itemId, max }: { itemId: string; max?: number }) {
  const [qty, setQty] = useState(1);
  return (
    <span className="inline-flex items-baseline gap-2">
      <Quantity
        value={qty}
        onChange={setQty}
        max={max}
        cap={MAX_BUY_AT_ONCE}
        label="How many to buy"
      />
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
    return <span className="text-note text-faint">no seeds</span>;
  }
  return (
    <span className="inline-flex items-baseline gap-2">
      <select
        value={seed}
        onChange={(e) => setSeed(e.target.value)}
        aria-label="Which seed"
        className="border-b border-rule bg-transparent py-0.5 text-note text-dim"
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
    <span className="inline-flex flex-wrap items-baseline gap-2">
      <select
        value={qty}
        onChange={(e) => setQty(Number(e.target.value))}
        aria-label="How many"
        className="border-b border-rule bg-transparent py-0.5 text-note text-dim"
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
        className="border-b border-rule bg-transparent py-0.5 text-note text-dim"
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
        className="border-b border-rule bg-transparent py-0.5 text-note text-dim"
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
