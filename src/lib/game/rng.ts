/**
 * Deterministic rolls, seeded from the session.
 *
 * Every roll in V2 — yield quantity, spawn rarity, quality, the stat band, a
 * drop table, a conversion success — is drawn from here, and the seed is always
 * the session id plus a channel name. That is not a stylistic choice: SPEC-V2
 * §10.2 makes it a requirement, because `db:recompute` has to reproduce a
 * session's outcome exactly and a non-deterministic roll would make the ledger
 * unrebuildable.
 *
 * No clock, no crypto, no global state. Same seed, same sequence, forever.
 */

/** FNV-1a over a string, so a seed can be any label. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type Rng = {
  /** Next float in [0, 1). */
  next(): number;
  /** Integer in [lo, hi], inclusive. */
  int(lo: number, hi: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** One entry, chosen by weight. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T;
  /** A fresh stream for a sub-channel, so callers cannot disturb each other. */
  channel(name: string): Rng;
};

/**
 * mulberry32. Small, fast, and good enough for loot: this decides how many ore
 * you got, not anything anyone should be able to predict for money.
 */
export function rng(seed: string): Rng {
  let state = hash(seed);
  const self: Rng = {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(lo, hi) {
      if (hi < lo) return lo;
      return lo + Math.floor(self.next() * (hi - lo + 1));
    },
    chance(p) {
      return self.next() < p;
    },
    weighted(items, weight) {
      const total = items.reduce((n, i) => n + Math.max(0, weight(i)), 0);
      if (total <= 0) return items[0];
      let roll = self.next() * total;
      for (const item of items) {
        roll -= Math.max(0, weight(item));
        if (roll <= 0) return item;
      }
      return items[items.length - 1];
    },
    channel(name) {
      return rng(`${seed}:${name}`);
    },
  };
  return self;
}

/**
 * The seed for one session's channel. Callers pass the session id, never a
 * timestamp — a timestamp would make the same session resolve differently on a
 * recompute, which is the whole failure this module exists to prevent.
 */
export function sessionSeed(sessionId: string, channel: string): string {
  return `${sessionId}/${channel}`;
}
